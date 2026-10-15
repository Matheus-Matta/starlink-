export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/**
 * Script inline executado no <head> antes da pintura: aplica a classe `dark`/`light`
 * conforme a preferência salva (ou a do sistema), evitando o "flash" de tema errado.
 * Renderizado pelo layout (Server Component) com o nonce da CSP.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.classList.toggle("light",!d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;
