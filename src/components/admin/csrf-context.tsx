"use client";

import { createContext, useContext, type ReactNode } from "react";

const CsrfContext = createContext<string | null>(null);

/** Disponibiliza o token CSRF da sessão (renderizado pelo servidor) aos formulários do painel. */
export function CsrfProvider({ token, children }: { token: string; children: ReactNode }) {
  return <CsrfContext.Provider value={token}>{children}</CsrfContext.Provider>;
}

export function useCsrfToken(): string | null {
  return useContext(CsrfContext);
}
