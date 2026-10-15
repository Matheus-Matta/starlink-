"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";

// Os ícones alternam via classe `dark` (CSS), evitando divergência de hidratação.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
      <span className="sr-only">Alternar tema claro/escuro</span>
    </Button>
  );
}
