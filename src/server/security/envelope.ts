// Formato de arquivo criptografado (sem dependências do Next: usado também pelos scripts).
//
//   [ "SLK" (3 bytes) | versão (1 byte) | nonce (12 bytes) | tag GCM (16 bytes) | ciphertext ]
//
// AES-256-GCM com nonce aleatório a cada gravação. O "contexto" (ex.: "clients/<id>") entra
// como AAD: um arquivo copiado/renomeado para outro registro falha na autenticação.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("SLK", "ascii");
export const ENVELOPE_VERSION = 1;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + NONCE_LENGTH + TAG_LENGTH;

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeError";
  }
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new EnvelopeError("A chave deve ter 32 bytes (AES-256).");
}

export function seal(key: Buffer, plaintext: Buffer, context: string): Buffer {
  assertKey(key);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const header = Buffer.concat([MAGIC, Buffer.from([ENVELOPE_VERSION]), nonce, cipher.getAuthTag()]);
  return Buffer.concat([header, ciphertext]);
}

export function open(key: Buffer, envelope: Buffer, context: string): Buffer {
  assertKey(key);
  if (envelope.length < HEADER_LENGTH || !envelope.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new EnvelopeError("Formato de arquivo desconhecido.");
  }
  const version = envelope[MAGIC.length];
  if (version !== ENVELOPE_VERSION) throw new EnvelopeError(`Versão de formato não suportada: ${version}.`);

  let offset = MAGIC.length + 1;
  const nonce = envelope.subarray(offset, (offset += NONCE_LENGTH));
  const tag = envelope.subarray(offset, (offset += TAG_LENGTH));
  const ciphertext = envelope.subarray(offset);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_LENGTH });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new EnvelopeError("Falha de autenticação: arquivo adulterado, corrompido ou chave incorreta.");
  }
}

export function sealJson(key: Buffer, value: unknown, context: string): Buffer {
  return seal(key, Buffer.from(JSON.stringify(value), "utf8"), context);
}

export function openJson<T>(key: Buffer, envelope: Buffer, context: string): T {
  return JSON.parse(open(key, envelope, context).toString("utf8")) as T;
}
