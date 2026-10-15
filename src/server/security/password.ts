import "server-only";

import { hash, verify } from "@node-rs/argon2";

import { ARGON2_OPTIONS } from "@/server/security/argon2-options";

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
