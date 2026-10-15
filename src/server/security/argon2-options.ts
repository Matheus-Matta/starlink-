// Sem dependências do Next: compartilhado entre o servidor e scripts/bootstrap-admin.ts.
import type { Algorithm, Options } from "@node-rs/argon2";

// `Algorithm` é um const enum ambiente (incompatível com isolatedModules): 2 = Argon2id.
const ARGON2ID = 2 as Algorithm;

/** Parâmetros Argon2id (recomendação OWASP: m ≥ 19 MiB, t ≥ 2, p = 1). */
export const ARGON2_OPTIONS: Options = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const MIN_ADMIN_PASSWORD_LENGTH = 12;
