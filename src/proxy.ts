import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["starlink_session", "__Host-starlink_session"];

/**
 * Executado antes das páginas:
 * 1. Gera um nonce por requisição e aplica a Content-Security-Policy (bloqueia scripts injetados).
 * 2. Redireciona ao login quem acessa /admin sem cookie de sessão. É só uma checagem otimista:
 *    a validação real da sessão acontece no servidor (requireAdminPage / requireAdminApi).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if ((pathname.startsWith("/admin") || pathname.startsWith("/cliente")) && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Radix/Tailwind aplicam estilos inline; estilos não executam código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Exclui APIs, redirecionamentos públicos (/r) e arquivos estáticos.
      source: "/((?!api|r/|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
