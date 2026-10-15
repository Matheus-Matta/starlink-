import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { toFieldErrors } from "@/lib/validation";
import { AppError } from "@/server/errors";
import { errorSummary, log } from "@/server/logger";

export const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export function json<T>(data: T, init: ResponseInit = {}): NextResponse<T> {
  return NextResponse.json(data, { ...init, headers: { ...NO_STORE, ...init.headers } });
}

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

/** Converte erros em respostas JSON seguras: nunca expõe stack trace nem detalhes internos. */
export function errorResponse(error: unknown, route: string): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
    return json({ error: { code: error.code, message: error.message, fields: error.fields } }, { status: error.status, headers });
  }
  if (error instanceof z.ZodError) {
    return json(
      { error: { code: "VALIDATION", message: "Verifique os campos destacados.", fields: toFieldErrors(error) } },
      { status: 422 },
    );
  }
  log("error", "api.unhandled_error", { route, ...errorSummary(error) });
  return json({ error: { code: "INTERNAL", message: "Erro interno. Tente novamente." } }, { status: 500 });
}

/** Envolve um Route Handler com tratamento uniforme de erros. */
export function handler<C>(route: string, fn: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      return await fn(request, context);
    } catch (error) {
      return errorResponse(error, route);
    }
  };
}

/** Lê e valida um corpo JSON com limite de tamanho. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S, maxBytes = 64 * 1024): Promise<z.infer<S>> {
  const text = await readText(request, maxBytes);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError("BAD_REQUEST", "Corpo da requisição inválido.");
  }
  return schema.parse(data);
}

export async function readText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Requisição muito grande.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Requisição muito grande.");
  return text;
}

/** Valida um parâmetro de rota (ex.: UUID) antes de qualquer uso. */
export function parseParam<S extends z.ZodType>(schema: S, value: unknown, label = "Registro"): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("NOT_FOUND", `${label} não encontrado(a).`);
  return result.data;
}
