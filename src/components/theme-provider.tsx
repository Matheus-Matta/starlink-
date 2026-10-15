"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePreference;
  /** Tema efetivamente aplicado (resolve "system"). `undefined` até montar no cliente. */
  resolvedTheme: "light" | "dark" | undefined;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  // Evita animações de transição durante a troca de tema.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  window.getComputedStyle(document.body);
  setTimeout(() => style.remove(), 1);
}

/**
 * Tema claro/escuro. A classe inicial é aplicada pelo script do <head> (THEME_INIT_SCRIPT);
 * este provider só mantém o estado no cliente, sem renderizar <script> (exigência do React 19).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Sincroniza com o que o script do <head> já aplicou (fonte externa: localStorage/mídia).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readPreference());
    const query = darkQuery();
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = systemDark === undefined ? undefined : theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (resolvedTheme) apply(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Armazenamento indisponível: o tema vale só nesta visita.
    }
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  return context;
}
