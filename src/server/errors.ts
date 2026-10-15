import "server-only";

import type { FieldErrors } from "@/lib/validation";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
};

/** Erro esperado, com mensagem segura para o usuário final. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} não encontrado(a).`);

export const staleVersion = () =>
  new AppError("CONFLICT", "Este registro foi alterado em outra aba ou sessão. Recarregue a página e tente novamente.");
