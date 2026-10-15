import "server-only";

import { normalizePlateCode } from "@/lib/plate-code";
import { getApp } from "@/server/container";
import { errorSummary, log } from "@/server/logger";
import { resolveAccess } from "@/server/redirects/resolve";
import { clientIp } from "@/server/security/guards";

/**
 * Links editáveis NÃO podem ser cacheados: 302 (nunca 301/308, que navegadores guardam
 * indefinidamente) + no-store, para que a troca de destino tenha efeito imediato.
 */
const REDIRECT_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function unavailable(status: 404 | 410 | 429 | 503, message: string, extra: Record<string, string> = {}): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link indisponível</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#333;text-align:center;padding:1rem}@media(prefers-color-scheme:dark){body{background:#181818;color:#eee}}</style></head><body><main><h1>Link indisponível</h1><p>${message}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      ...REDIRECT_HEADERS,
      ...extra,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}

/** Trata o acesso a /r/<código> (código atual ou anterior da placa). */
export async function handlePublicAccess(request: Request, rawCode: string): Promise<Response> {
  try {
    const app = await getApp();
    const limit = app.publicLimiter.consume(clientIp(request.headers, app.config));
    if (!limit.allowed) {
      return unavailable(429, "Muitas requisições. Tente novamente em instantes.", { "Retry-After": String(limit.retryAfterSeconds) });
    }

    const code = normalizePlateCode(rawCode);
    const plate = code ? app.plateRepository.getByCode(code) : undefined;
    if (!plate) return unavailable(404, "Este link não existe.");

    const now = new Date();
    const resolution = resolveAccess(plate, now);
    if (resolution.outcome === "unavailable") {
      return resolution.reason === "archived"
        ? unavailable(410, "Este link foi desativado.")
        : unavailable(404, "Este link está temporariamente sem destino.");
    }

    app.stats.record(plate.id, now);
    const location = resolution.outcome === "redirect" ? resolution.url : `${app.config.publicBaseUrl}/p/${plate.code}`;
    return new Response(null, { status: 302, headers: { ...REDIRECT_HEADERS, Location: location } });
  } catch (error) {
    log("error", "public.access_failed", errorSummary(error));
    return unavailable(503, "Serviço temporariamente indisponível.");
  }
}
