// Gera o hash Argon2id da senha do administrador e os segredos da aplicação.
//
//   npm run admin:bootstrap                 → imprime as variáveis para colar no .env
//   npm run admin:bootstrap -- --env .env   → grava no arquivo (preserva chaves já existentes)
//
// A senha é lida do terminal sem eco (ou da 1ª linha do stdin, quando redirecionado).
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import readline from "node:readline";

import { hash } from "@node-rs/argon2";

import { ARGON2_OPTIONS, MIN_ADMIN_PASSWORD_LENGTH } from "../src/server/security/argon2-options.ts";
import { fail, parseArgs } from "./lib.ts";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let muted = false;
    output._writeToOutput = (s: string) => {
      if (!muted || s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function readStdinLine(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "";
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readStdinLine();
  const first = await askHidden("Nova senha do administrador: ");
  const second = await askHidden("Confirme a senha: ");
  if (first !== second) fail("As senhas não conferem.");
  return first;
}

/** Atualiza/insere variáveis em um arquivo .env, preservando as demais linhas. */
async function upsertEnv(file: string, values: Record<string, string>, onlyIfMissing: Set<string>): Promise<string[]> {
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const lines = content.split(/\r?\n/);
  const changed: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (index >= 0) {
      if (onlyIfMissing.has(key) && lines[index].length > key.length + 1) continue;
      lines[index] = `${key}=${value}`;
    } else {
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      lines.push(`${key}=${value}`, "");
    }
    changed.push(key);
  }
  await fs.writeFile(file, lines.join("\n"), { mode: 0o600 });
  return changed;
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const password = await readPassword();
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) fail(`A senha precisa ter pelo menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`);

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const values = {
    // Base64 evita que o "$" do hash seja interpretado pelo carregador de .env / Docker Compose.
    ADMIN_PASSWORD_HASH_B64: Buffer.from(passwordHash, "utf8").toString("base64"),
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };

  if (typeof flags.env === "string") {
    // Nunca troca chaves existentes: trocar DATA_ENCRYPTION_KEY tornaria os dados ilegíveis.
    const changed = await upsertEnv(flags.env, values, new Set(["SESSION_SECRET", "DATA_ENCRYPTION_KEY"]));
    console.log(`✔ ${flags.env} atualizado: ${changed.join(", ")}`);
    if (changed.includes("DATA_ENCRYPTION_KEY")) {
      console.log("⚠ Nova DATA_ENCRYPTION_KEY gerada. Guarde uma cópia em local seguro (ex.: gerenciador de senhas):");
      console.log("  sem ela, os dados e os backups não podem ser recuperados.");
    }
    console.log("Reinicie a aplicação para aplicar (sessões ativas serão encerradas).");
    return;
  }

  console.log("\n# Copie para o .env (NUNCA versione este arquivo).");
  console.log("# Se já houver DATA_ENCRYPTION_KEY com dados gravados, mantenha a chave atual.");
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
