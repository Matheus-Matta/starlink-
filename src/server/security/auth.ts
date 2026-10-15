import "server-only";

import type { AppConfig } from "@/server/config";
import { AppError } from "@/server/errors";
import { log } from "@/server/logger";
import { verifyPassword } from "@/server/security/password";
import { RateLimiter } from "@/server/security/rate-limit";
import type { Session, SessionStore } from "@/server/security/sessions";

const GENERIC_FAILURE = "Senha incorreta.";

export class AuthService {
  /** Por IP: 5 tentativas a cada 15 min; bloqueio de 15 min que dobra a cada reincidência (até 4 h). */
  private readonly perIp = new RateLimiter({ limit: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000, maxBlockMs: 4 * 3600_000 });
  /** Global: protege contra ataque distribuído (muitos IPs), sem travar o admin por tempo longo. */
  private readonly global = new RateLimiter({ limit: 30, windowMs: 15 * 60_000, blockMs: 5 * 60_000, maxBlockMs: 30 * 60_000 });

  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionStore,
  ) {}

  async login(password: string, ip: string): Promise<{ token: string; session: Session }> {
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

    // A verificação Argon2 sempre roda, mantendo o tempo de resposta uniforme.
    const ok = await verifyPassword(this.config.adminPasswordHash, password);
    if (!ok) {
      log("warn", "auth.login_failed");
      throw new AppError("UNAUTHORIZED", GENERIC_FAILURE);
    }
    this.perIp.reset(`ip:${ip}`);
    log("info", "auth.login_succeeded");
    return this.sessions.create();
  }

  logout(token: string | undefined): void {
    this.sessions.destroy(token);
  }
}
