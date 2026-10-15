"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useCsrfToken } from "@/components/admin/csrf-context";

export type ApiError = { code: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Chamada às APIs do painel: envia o token CSRF, trata sessão expirada e
 * normaliza erros. Mantém `pending` para desabilitar botões durante o envio.
 */
export function useApi() {
  const router = useRouter();
  const csrf = useCsrfToken();
  const [pending, setPending] = useState(false);

  const call = useCallback(
    async <T>(method: Method, url: string, body?: unknown): Promise<ApiResult<T>> => {
      setPending(true);
      try {
        const headers: Record<string, string> = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (csrf) headers["x-csrf-token"] = csrf;
        const response = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { error?: ApiError } | null;
        if (response.status === 401 && url !== "/api/auth/login") {
          router.replace("/login");
          return { ok: false, error: { code: "UNAUTHORIZED", message: "Sessão expirada." } };
        }
        if (!response.ok) {
          return { ok: false, error: payload?.error ?? { code: "HTTP", message: `Erro ${response.status}.` } };
        }
        return { ok: true, data: payload as T };
      } catch {
        return { ok: false, error: { code: "NETWORK", message: "Falha de conexão. Verifique sua rede." } };
      } finally {
        setPending(false);
      }
    },
    [csrf, router],
  );

  return { call, pending };
}
