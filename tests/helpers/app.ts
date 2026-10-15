import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AppConfig } from "@/server/config";

export async function makeTempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "starlink-test-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function makeConfig(storageDir: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    isProduction: false,
    adminPasswordHash: "$argon2id$placeholder",
    sessionSecret: "x".repeat(48),
    dataKey: randomBytes(32),
    publicBaseUrl: "https://placas.exemplo.com",
    storageDir,
    timeZone: "America/Sao_Paulo",
    trustProxy: false,
    sessionTtlMs: 8 * 3600_000,
    sessionIdleMs: 3600_000,
    statsFlushMs: 60_000,
    ...overrides,
  };
}
