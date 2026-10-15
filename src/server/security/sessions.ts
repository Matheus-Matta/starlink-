import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type Session = {
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
};

export const SESSION_COOKIE_DEV = "starlink_session";
/** Prefixo __Host-: exige Secure, Path=/ e proíbe Domain (não vaza para subdomínios). */
export const SESSION_COOKIE_PROD = "__Host-starlink_session";

/**
 * Sessões no servidor (memória). O cookie carrega um token aleatório de 256 bits;
 * o servidor guarda apenas o HMAC dele, então um dump de memória não permite reusar sessões.
 * Logout e expiração são efetivos imediatamente. Reiniciar o processo encerra as sessões.
 */
export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly idleMs: number,
  ) {}

  private keyOf(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("base64url");
  }

  create(now: number = Date.now()): { token: string; session: Session } {
    this.prune(now);
    const token = randomBytes(32).toString("base64url");
    const session: Session = {
      csrfToken: randomBytes(32).toString("base64url"),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.sessions.set(this.keyOf(token), session);
    return { token, session };
  }

  /** Valida o token e renova o prazo de inatividade. */
  get(token: string | undefined, now: number = Date.now()): Session | null {
    if (!token || token.length > 128) return null;
    const key = this.keyOf(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (now >= session.expiresAt || now - session.lastSeenAt >= this.idleMs) {
      this.sessions.delete(key);
      return null;
    }
    session.lastSeenAt = now;
    return session;
  }

  destroy(token: string | undefined): void {
    if (token) this.sessions.delete(this.keyOf(token));
  }

  destroyAll(): void {
    this.sessions.clear();
  }

  private prune(now: number): void {
    for (const [key, session] of this.sessions) {
      if (now >= session.expiresAt || now - session.lastSeenAt >= this.idleMs) this.sessions.delete(key);
    }
  }
}

/** Comparação em tempo constante para tokens CSRF. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
