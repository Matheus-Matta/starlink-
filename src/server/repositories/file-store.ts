import "server-only";

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { EnvelopeError, openJson, sealJson } from "@/server/security/envelope";

/** Coleções permitidas: nenhum caminho é derivado de entrada livre. */
export type Collection = "clients" | "credentials" | "plates" | "stats";

/** Caminhos relativos ao STORAGE_DIR, sempre com "/" (também usados em logs e backups). */
const COLLECTION_DIRS: Record<Collection, string> = {
  clients: "data/clients",
  credentials: "data/credentials",
  plates: "data/plates",
  stats: "stats",
};

const ID_PATTERNS: Record<Collection, RegExp> = {
  clients: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  credentials: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  plates: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  stats: /^\d{4}-\d{2}$/,
};

const EXTENSION = ".enc";
const TMP_MARKER = ".tmp-";

export type LoadResult<T> = {
  records: T[];
  /** Arquivos que falharam na autenticação/leitura (adulterados ou corrompidos). */
  corrupt: string[];
};

export class FileStore {
  constructor(
    private readonly root: string,
    private readonly key: Buffer,
  ) {}

  private dir(collection: Collection): string {
    return path.join(this.root, ...COLLECTION_DIRS[collection].split("/"));
  }

  private filePath(collection: Collection, id: string): string {
    if (!ID_PATTERNS[collection].test(id)) throw new Error(`Identificador inválido para ${collection}.`);
    return path.join(this.dir(collection), `${id}${EXTENSION}`);
  }

  private context(collection: Collection, id: string): string {
    return `${collection}/${id}`;
  }

  async init(): Promise<void> {
    for (const collection of Object.keys(COLLECTION_DIRS) as Collection[]) {
      const dir = this.dir(collection);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      // Remove temporários deixados por gravações interrompidas (o arquivo final permanece íntegro).
      for (const name of await fs.readdir(dir)) {
        if (name.includes(TMP_MARKER)) await fs.rm(path.join(dir, name), { force: true });
      }
    }
  }

  async read<T>(collection: Collection, id: string): Promise<T | null> {
    let data: Buffer;
    try {
      data = await fs.readFile(this.filePath(collection, id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    return openJson<T>(this.key, data, this.context(collection, id));
  }

  async readAll<T>(collection: Collection): Promise<LoadResult<T>> {
    const dir = this.dir(collection);
    const records: T[] = [];
    const corrupt: string[] = [];
    for (const name of await fs.readdir(dir)) {
      if (!name.endsWith(EXTENSION)) continue;
      const id = name.slice(0, -EXTENSION.length);
      if (!ID_PATTERNS[collection].test(id)) continue;
      try {
        const data = await fs.readFile(path.join(dir, name));
        records.push(openJson<T>(this.key, data, this.context(collection, id)));
      } catch (error) {
        if (error instanceof EnvelopeError || error instanceof SyntaxError) {
          corrupt.push(`${COLLECTION_DIRS[collection]}/${name}`);
          continue;
        }
        throw error;
      }
    }
    return { records, corrupt };
  }

  /** Gravação atômica: arquivo temporário → fsync → rename → fsync do diretório. */
  async write(collection: Collection, id: string, value: unknown): Promise<void> {
    const target = this.filePath(collection, id);
    const sealed = sealJson(this.key, value, this.context(collection, id));
    await writeFileAtomic(target, sealed);
  }

  async remove(collection: Collection, id: string): Promise<void> {
    await fs.rm(this.filePath(collection, id), { force: true });
    await syncDirectory(this.dir(collection));
  }
}

export async function writeFileAtomic(target: string, data: Buffer): Promise<void> {
  const tmp = `${target}${TMP_MARKER}${randomBytes(6).toString("hex")}`;
  const handle = await fs.open(tmp, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
  await syncDirectory(path.dirname(target));
}

async function syncDirectory(dir: string): Promise<void> {
  // Garante que o rename sobreviva a uma queda de energia (POSIX). No Windows, abrir
  // diretórios não é suportado; o NTFS já registra o rename no journal.
  if (process.platform === "win32") return;
  const handle = await fs.open(dir, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
