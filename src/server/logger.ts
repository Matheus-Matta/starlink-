import "server-only";

type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

/**
 * Log estruturado (JSON por linha). Aceita apenas campos primitivos e explícitos:
 * nunca registre corpo de requisição, senhas, chaves, documentos ou destinos.
 */
export function log(level: Level, event: string, fields: Fields = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Resumo seguro de um erro: nome e código, sem stack nem mensagem (que pode conter dados). */
export function errorSummary(error: unknown): Fields {
  if (error instanceof Error) {
    return { errorName: error.name, errorCode: (error as NodeJS.ErrnoException).code ?? null };
  }
  return { errorName: typeof error };
}
