// Utilitários dos scripts operacionais (executados com `node`, que remove os tipos do TS).
import { promises as fs } from "node:fs";
import path from "node:path";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Únicos caminhos de dados aceitos (relativos ao STORAGE_DIR). Bloqueia path traversal. */
export const RECORD_PATH_RE = new RegExp(`^(data/(clients|plates)/${UUID}|stats/\\d{4}-\\d{2})\\.enc$`);

export function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

export function storageDir(): string {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

export function loadKey(name: string): Buffer {
  const value = process.env[name];
  if (!value) fail(`${name} não definido (use um .env ou exporte a variável).`);
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) fail(`${name} deve conter exatamente 32 bytes em base64.`);
  return key;
}

/** Contexto (AAD) de um registro: "clients/<id>", "plates/<id>" ou "stats/<mês>". */
export function contextFor(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.enc$/, "");
  return withoutExt.startsWith("data/") ? withoutExt.slice("data/".length) : withoutExt;
}

/** Lista os arquivos de registro (caminhos relativos com "/"). */
export async function listRecordFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const dir of ["data/clients", "data/plates", "stats"]) {
    let names: string[];
    try {
      names = await fs.readdir(path.join(root, dir));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const name of names) {
      const rel = `${dir}/${name}`;
      if (RECORD_PATH_RE.test(rel)) result.push(rel);
    }
  }
  return result.sort();
}

export function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      const next = argv[i + 1];
      if (inline !== undefined) flags[key] = inline;
      else if (next !== undefined && !next.startsWith("--")) flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

export function timestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}
