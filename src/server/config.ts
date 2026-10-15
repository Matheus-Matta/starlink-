import "server-only";

import path from "node:path";

import { z } from "zod";

import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ADMIN_PASSWORD_HASH_B64: z
    .string({ error: "ADMIN_PASSWORD_HASH_B64 não definido (gere com `npm run admin:bootstrap`)." })
    .transform((v) => Buffer.from(v, "base64").toString("utf8"))
    .refine((v) => v.startsWith("$argon2id$"), "ADMIN_PASSWORD_HASH_B64 deve conter um hash Argon2id em base64."),
  SESSION_SECRET: z
    .string({ error: "SESSION_SECRET não definido." })
    .min(32, "SESSION_SECRET deve ter pelo menos 32 caracteres."),
  DATA_ENCRYPTION_KEY: z
    .string({ error: "DATA_ENCRYPTION_KEY não definido." })
    .transform((v) => Buffer.from(v, "base64"))
    .refine((v) => v.length === 32, "DATA_ENCRYPTION_KEY deve ter exatamente 32 bytes em base64."),
  PUBLIC_BASE_URL: z
    .url("PUBLIC_BASE_URL deve ser uma URL absoluta.")
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),
  STORAGE_DIR: z.string().default("./storage"),
  APP_TIME_ZONE: z.string().default(DEFAULT_TIME_ZONE).refine(isValidTimeZone, "APP_TIME_ZONE inválido."),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(8),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  STATS_FLUSH_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
});

export type AppConfig = {
  isProduction: boolean;
  adminPasswordHash: string;
  sessionSecret: string;
  dataKey: Buffer;
  publicBaseUrl: string;
  storageDir: string;
  timeZone: string;
  trustProxy: boolean;
  sessionTtlMs: number;
  sessionIdleMs: number;
  statsFlushMs: number;
};

let cached: AppConfig | undefined;

/**
 * Lê e valida o ambiente sob demanda (nunca no build). Falha com mensagem que cita
 * apenas o nome da variável — o valor nunca é incluído.
 */
export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida:\n${problems}`);
  }
  const env = parsed.data;
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.PUBLIC_BASE_URL).hostname);
  if (env.NODE_ENV === "production" && !env.PUBLIC_BASE_URL.startsWith("https://") && !isLocalhost) {
    throw new Error("Configuração inválida:\n- PUBLIC_BASE_URL deve usar https:// em produção.");
  }
  cached = {
    isProduction: env.NODE_ENV === "production",
    adminPasswordHash: env.ADMIN_PASSWORD_HASH_B64,
    sessionSecret: env.SESSION_SECRET,
    dataKey: env.DATA_ENCRYPTION_KEY,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    storageDir: path.resolve(env.STORAGE_DIR),
    timeZone: env.APP_TIME_ZONE,
    trustProxy: env.TRUST_PROXY,
    sessionTtlMs: env.SESSION_TTL_HOURS * 3600_000,
    sessionIdleMs: env.SESSION_IDLE_MINUTES * 60_000,
    statsFlushMs: env.STATS_FLUSH_SECONDS * 1000,
  };
  return cached;
}
