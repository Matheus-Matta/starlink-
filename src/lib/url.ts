export const MAX_URL_LENGTH = 2048;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Valida um destino de redirecionamento: somente http/https, com host,
 * sem credenciais embutidas e sem caracteres de controle.
 * Retorna a URL normalizada pelo parser WHATWG.
 */
export function checkDestinationUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (raw.length === 0) return { ok: false, reason: "Informe a URL." };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: `A URL excede ${MAX_URL_LENGTH} caracteres.` };
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return { ok: false, reason: "A URL contém espaços ou caracteres inválidos." };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "URL inválida. Use o formato https://exemplo.com." };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return { ok: false, reason: "Somente URLs http:// ou https:// são permitidas." };
  if (!parsed.hostname) return { ok: false, reason: "A URL precisa de um domínio." };
  if (parsed.username || parsed.password) return { ok: false, reason: "A URL não pode conter usuário ou senha." };

  const normalized = parsed.toString();
  if (normalized.length > MAX_URL_LENGTH) return { ok: false, reason: `A URL excede ${MAX_URL_LENGTH} caracteres.` };
  return { ok: true, url: normalized };
}
