// Backup criptografado do STORAGE_DIR.
//
//   npm run backup                       → grava em ./backups (ou BACKUP_DIR)
//   npm run backup -- --out /mnt/backup  → diretório de destino
//
// Formato: JSON (lista de arquivos + SHA-256) → gzip → AES-256-GCM (mesmo envelope dos dados).
// A chave usada é BACKUP_ENCRYPTION_KEY (se definida) ou DATA_ENCRYPTION_KEY. A chave NUNCA
// vai dentro do backup: guarde-a separadamente (ex.: gerenciador de senhas / cofre).
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { open, seal } from "../src/server/security/envelope.ts";
import { contextFor, fail, listRecordFiles, loadKey, parseArgs, storageDir, timestamp } from "./lib.ts";

export const BACKUP_CONTEXT = "starlink-backup/v1";

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const root = storageDir();
  const dataKey = loadKey("DATA_ENCRYPTION_KEY");
  const backupKey = process.env.BACKUP_ENCRYPTION_KEY ? loadKey("BACKUP_ENCRYPTION_KEY") : dataKey;
  const outDir = path.resolve(typeof flags.out === "string" ? flags.out : (process.env.BACKUP_DIR ?? "./backups"));
  const keep = Number(process.env.BACKUP_KEEP ?? "14");

  const files = await listRecordFiles(root);
  const entries: Array<{ path: string; sha256: string; data: string }> = [];
  const corrupt: string[] = [];
  for (const rel of files) {
    const data = await fs.readFile(path.join(root, rel));
    try {
      open(dataKey, data, contextFor(rel)); // só copia o que está íntegro
    } catch {
      corrupt.push(rel);
      continue;
    }
    entries.push({ path: rel, sha256: createHash("sha256").update(data).digest("hex"), data: data.toString("base64") });
  }
  if (corrupt.length && flags["allow-corrupt"] !== true) {
    fail(`${corrupt.length} arquivo(s) com falha de integridade: ${corrupt.join(", ")}. Use --allow-corrupt para ignorá-los.`);
  }

  const manifest = { format: "starlink-backup", version: 1, createdAt: new Date().toISOString(), files: entries };
  const sealed = seal(backupKey, gzipSync(Buffer.from(JSON.stringify(manifest), "utf8")), BACKUP_CONTEXT);

  await fs.mkdir(outDir, { recursive: true, mode: 0o700 });
  const target = path.join(outDir, `starlink-${timestamp()}.slkbak`);
  const tmp = `${target}.tmp-${randomBytes(4).toString("hex")}`;
  await fs.writeFile(tmp, sealed, { mode: 0o600, flag: "wx" });
  await fs.rename(tmp, target);
  console.log(`✔ Backup criado: ${target} (${entries.length} arquivos${corrupt.length ? `, ${corrupt.length} ignorados` : ""})`);

  if (keep > 0) {
    const backups = (await fs.readdir(outDir)).filter((n) => /^starlink-\d{8}-\d{6}\.slkbak$/.test(n)).sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
      await fs.rm(path.join(outDir, old));
      console.log(`  removido backup antigo: ${old}`);
    }
  }
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
