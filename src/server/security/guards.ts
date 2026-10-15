import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AppConfig } from "@/server/config";
import { getApp } from "@/server/container";
import { AppError } from "@/server/errors";
import { SESSION_COOKIE_DEV, SESSION_COOKIE_PROD, safeEqual, type Session } from "@/server/security/sessions";

export const CSRF_HEADER = "x-csrf-token";

export function sessionCookieName(config: AppConfig): string {
  return config.isProduction ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}

export function sessionCookieOptions(config: AppConfig, expiresAt: number) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

/**
 * IP do cliente. Só confia em X-Forwarded-For quando TRUST_PROXY=true (atrás do proxy reverso),
 * usando a entrada mais à direita — a adicionada pelo nosso proxy, que o cliente não controla.
 */
export function clientIp(headers: Headers, config: AppConfig): string {
  if (config.trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    const last = forwarded?.split(",").map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last.slice(0, 64);
    const real = headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "direct";
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defesa CSRF (1/2): mutações só são aceitas se a origem for a própria aplicação.
 * Navegadores modernos sempre enviam Origin em requisições POST/PUT/PATCH/DELETE.
 */
export function assertSameOrigin(request: Request, config: AppConfig): void {
  if (!UNSAFE_METHODS.has(request.method)) return;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new AppError("FORBIDDEN", "Origem da requisição não permitida.");
  }
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "Origem da requisição ausente.");
  const allowed = new Set([new URL(config.publicBaseUrl).origin]);
  const host = request.headers.get("host");
  if (host && !config.isProduction) allowed.add(`${new URL(request.url).protocol}//${host}`);
  if (!allowed.has(origin)) throw new AppError("FORBIDDEN", "Origem da requisição não permitida.");
}

/**
 * Autorização das APIs administrativas — chamada em TODA operação.
 * Exige sessão válida e, em mutações, origem válida + token CSRF da sessão (defesa 2/2).
 */
export async function requireAdminApi(request: Request): Promise<Session> {
  const app = await getApp();
  const store = await cookies();
  const session = app.sessions.get(store.get(sessionCookieName(app.config))?.value);
  if (!session) throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre novamente.");
  if (UNSAFE_METHODS.has(request.method)) {
    assertSameOrigin(request, app.config);
    const token = request.headers.get(CSRF_HEADER);
    if (!token || !safeEqual(token, session.csrfToken)) throw new AppError("FORBIDDEN", "Token CSRF inválido. Recarregue a página.");
  }
  return session;
}

/** Para Server Components do painel: redireciona ao login sem sessão válida. */
export async function requireAdminPage(): Promise<Session> {
  const app = await getApp();
  const store = await cookies();
  const session = app.sessions.get(store.get(sessionCookieName(app.config))?.value);
  if (!session) redirect("/login");
  return session;
}
