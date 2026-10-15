// Restaura um backup criado por scripts/backup.ts. Execute com a aplicação PARADA.
//
//   npm run restore -- backups/starlink-20260101-030000.slkbak            → valida e restaura no STORAGE_DIR vazio
//   npm run restore -- <arquivo> --target ./storage-teste                 → restaura em outro diretório (teste de restauração)
//   npm run restore -- <arquivo> --force                                  → move os dados atuais para <dir>/before-restore-<data>
//   npm run restore -- <arquivo> --dry-run                                → apenas valida
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { open } from "../src/server/security/envelope.ts";
import { RECORD_PATH_RE, contextFor, fail, listRecordFiles, loadKey, parseArgs, storageDir, timestamp } from "./lib.ts";

const BACKUP_CONTEXT = "starlink-backup/v1";

type Manifest = { format: string; version: number; createdAt: string; files: Array<{ path: string; sha256: string; data: string }> };

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const file = positional[0];
  if (!file) fail("Informe o arquivo de backup. Ex.: npm run restore -- backups/starlink-AAAAMMDD-HHMMSS.slkbak");

  const dataKey = loadKey("DATA_ENCRYPTION_KEY");
  const backupKey = process.env.BACKUP_ENCRYPTION_KEY ? loadKey("BACKUP_ENCRYPTION_KEY") : dataKey;
  const target = typeof flags.target === "string" ? path.resolve(flags.target) : storageDir();

  let manifest: Manifest;
  try {
    manifest = JSON.parse(gunzipSync(open(backupKey, await fs.readFile(file), BACKUP_CONTEXT)).toString("utf8")) as Manifest;
  } catch {
    fail("Não foi possível abrir o backup: arquivo corrompido ou chave incorreta.");
  }
  if (manifest.format !== "starlink-backup" || manifest.version !== 1) fail("Formato de backup não suportado.");

  // Valida tudo antes de escrever qualquer arquivo.
  const decoded = manifest.files.map((entry) => {
    if (!RECORD_PATH_RE.test(entry.path)) fail(`Caminho inválido no backup: ${entry.path}`);
    const data = Buffer.from(entry.data, "base64");
    if (createHash("sha256").update(data).digest("hex") !== entry.sha256) fail(`Checksum divergente: ${entry.path}`);
    try {
      open(dataKey, data, contextFor(entry.path));
    } catch {
      fail(`Registro não pode ser lido com a DATA_ENCRYPTION_KEY atual: ${entry.path}`);
    }
    return { rel: entry.path, data };
  });
  console.log(`✔ Backup de ${manifest.createdAt} válido: ${decoded.length} arquivos.`);
  if (flags["dry-run"] === true) return;

  const existing = await listRecordFiles(target);
  if (existing.length > 0) {
    if (flags.force !== true) fail(`${target} já contém ${existing.length} arquivo(s). Use --force para mover os dados atuais antes de restaurar.`);
    // Move para uma subpasta (e não renomeia o diretório): no Docker, STORAGE_DIR é um volume montado.
    const moved = path.join(target, `before-restore-${timestamp()}`);
    await fs.mkdir(moved, { recursive: true, mode: 0o700 });
    for (const dir of ["data", "stats"]) {
      await fs.rename(path.join(target, dir), path.join(moved, dir)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    console.log(`  dados atuais movidos para ${moved}`);
  }

  for (const { rel, data } of decoded) {
    const dest = path.join(target, ...rel.split("/"));
    await fs.mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
    await fs.writeFile(dest, data, { mode: 0o600 });
  }
  console.log(`✔ Restaurado em ${target}. Inicie a aplicação e confira /api/health.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
