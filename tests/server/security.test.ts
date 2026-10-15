import { describe, expect, it, vi } from "vitest";

// guards.ts importa next/headers e o container; aqui testamos só as funções puras.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { AppError } from "@/server/errors";
import { assertSameOrigin, clientIp } from "@/server/security/guards";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { RateLimiter } from "@/server/security/rate-limit";
import { SessionStore, safeEqual } from "@/server/security/sessions";
import { makeConfig } from "../helpers/app";

describe("senha (Argon2id)", () => {
  it("gera hash argon2id e verifica", async () => {
    const hash = await hashPassword("senha-forte-123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "senha-forte-123")).toBe(true);
    expect(await verifyPassword(hash, "errada")).toBe(false);
    expect(await verifyPassword("hash-invalido", "x")).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("bloqueia após o limite e dobra o bloqueio a cada reincidência", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 1000, blockMs: 1000 });
    expect(limiter.consume("ip", 0).allowed).toBe(true);
    expect(limiter.consume("ip", 1).allowed).toBe(true);
    expect(limiter.consume("ip", 2)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("ip", 500).allowed).toBe(false);
    expect(limiter.consume("ip", 1003).allowed).toBe(true);
    limiter.consume("ip", 1004);
    expect(limiter.consume("ip", 1005)).toEqual({ allowed: false, retryAfterSeconds: 2 });
  });

  it("isola chaves e permite reset", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
    limiter.consume("a", 0);
    expect(limiter.consume("a", 1).allowed).toBe(false);
    expect(limiter.consume("b", 1).allowed).toBe(true);
    limiter.reset("a");
    expect(limiter.consume("a", 2).allowed).toBe(true);
  });

  it("limita a memória usada", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10 });
    for (let i = 0; i < 100; i++) limiter.consume(`ip-${i}`, i);
    expect((limiter as unknown as { buckets: Map<string, unknown> }).buckets.size).toBeLessThanOrEqual(10);
  });
});

describe("SessionStore", () => {
  it("cria, valida, expira por inatividade e por tempo absoluto", () => {
    const store = new SessionStore("s".repeat(40), 10_000, 3_000);
    const { token } = store.create(0);
    expect(store.get(token, 2_000)).not.toBeNull();
    expect(store.get(token, 4_500)).not.toBeNull(); // renovou em 2000
    expect(store.get(token, 8_000)).toBeNull(); // inativa por 3500ms
    const second = store.create(0);
    for (let t = 2_000; t < 10_000; t += 2_000) expect(store.get(second.token, t)).not.toBeNull();
    expect(store.get(second.token, 10_000)).toBeNull(); // TTL absoluto
  });

  it("logout invalida imediatamente e tokens desconhecidos são rejeitados", () => {
    const store = new SessionStore("s".repeat(40), 10_000, 10_000);
    const { token } = store.create(0);
    store.destroy(token);
    expect(store.get(token, 1)).toBeNull();
    expect(store.get("inventado", 1)).toBeNull();
    expect(store.get(undefined, 1)).toBeNull();
  });

  it("compara tokens em tempo constante", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("guards", () => {
  const config = makeConfig("/tmp", { publicBaseUrl: "https://placas.exemplo.com" });
  const req = (method: string, headers: Record<string, string>) => new Request("https://placas.exemplo.com/api/x", { method, headers });

  it("aceita mutações da própria origem e rejeita outras (CSRF)", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "https://placas.exemplo.com" }), config)).not.toThrow();
    expect(() => assertSameOrigin(req("GET", {}), config)).not.toThrow();
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.com" }), config)).toThrow(AppError);
    expect(() => assertSameOrigin(req("POST", {}), config)).toThrow(AppError);
    expect(() =>
      assertSameOrigin(req("DELETE", { origin: "https://placas.exemplo.com", "sec-fetch-site": "cross-site" }), config),
    ).toThrow(AppError);
  });

  it("só usa X-Forwarded-For com TRUST_PROXY, pegando a entrada do proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(headers, config)).toBe("direct");
    expect(clientIp(headers, { ...config, trustProxy: true })).toBe("203.0.113.9");
  });
});
