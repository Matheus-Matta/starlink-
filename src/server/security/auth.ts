import "server-only";

import type { AppConfig } from "@/server/config";
import { AppError } from "@/server/errors";
import { log } from "@/server/logger";
import type { ClientRepository } from "@/server/repositories/client-repository";
import type { CredentialRepository } from "@/server/repositories/credential-repository";
import { verifyPassword } from "@/server/security/password";
import { RateLimiter } from "@/server/security/rate-limit";
import type { Session, SessionStore } from "@/server/security/sessions";

const GENERIC_FAILURE = "Usuário ou senha incorretos.";

export class AuthService {
  private readonly perIp = new RateLimiter({ limit: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000, maxBlockMs: 4 * 3600_000 });
  private readonly global = new RateLimiter({ limit: 30, windowMs: 15 * 60_000, blockMs: 5 * 60_000, maxBlockMs: 30 * 60_000 });

  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionStore,
    private readonly clients: ClientRepository,
    private readonly credentials: CredentialRepository,
  ) {}

  async login(identifier: string, password: string, ip: string): Promise<{ token: string; session: Session }> {
    for (const decision of [this.perIp.consume(`ip:${ip}`), this.global.consume("global")]) {
      if (!decision.allowed) {
        log("warn", "auth.rate_limited", { retryAfter: decision.retryAfterSeconds });
        throw new AppError(
          "RATE_LIMITED",
          `Muitas tentativas. Tente novamente em ${Math.ceil(decision.retryAfterSeconds / 60)} min.`,
          undefined,
          decision.retryAfterSeconds,
        );
      }
    }

    const normalized = identifier.trim().toLowerCase();
    const isAdmin = normalized === "admin" || normalized === "";
    const client = isAdmin ? undefined : this.clients.list().find((item) => item.email === normalized);
    const credential = client ? this.credentials.get(client.id) : undefined;
    const clientCanLogin = Boolean(client && client.status === "active" && !client.anonymized && credential?.enabled);

    // Argon2 sempre é executado, inclusive para identificadores inexistentes.
    const hash = isAdmin ? this.config.adminPasswordHash : credential?.passwordHash ?? this.config.adminPasswordHash;
    const ok = await verifyPassword(hash, password);
    if (!ok || (!isAdmin && !clientCanLogin)) {
      log("warn", "auth.login_failed");
      throw new AppError("UNAUTHORIZED", GENERIC_FAILURE);
    }

    this.perIp.reset(`ip:${ip}`);
    const principal = isAdmin ? ({ role: "admin" } as const) : ({ role: "client", clientId: client!.id } as const);
    log("info", "auth.login_succeeded", { role: principal.role });
    return this.sessions.create(Date.now(), principal);
  }

  logout(token: string | undefined): void {
    this.sessions.destroy(token);
  }
}
