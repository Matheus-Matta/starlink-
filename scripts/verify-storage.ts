// Verifica a integridade (autenticação GCM) de todos os arquivos do STORAGE_DIR.
//   npm run storage:verify
import { promises as fs } from "node:fs";
import path from "node:path";

import { open } from "../src/server/security/envelope.ts";
import { contextFor, fail, listRecordFiles, loadKey, storageDir } from "./lib.ts";

async function main() {
  const root = storageDir();
  const key = loadKey("DATA_ENCRYPTION_KEY");
  const files = await listRecordFiles(root);
  const corrupt: string[] = [];
  for (const rel of files) {
    try {
      open(key, await fs.readFile(path.join(root, rel)), contextFor(rel));
    } catch {
      corrupt.push(rel);
    }
  }
  if (corrupt.length) fail(`${corrupt.length}/${files.length} arquivo(s) com falha de integridade:\n  ${corrupt.join("\n  ")}`);
  console.log(`✔ ${files.length} arquivo(s) íntegros em ${root}.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
