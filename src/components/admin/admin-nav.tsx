"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Painel", exact: true },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/plates", label: "Placas" },
  { href: "/admin/links", label: "Links" },
  { href: "/admin/plates/import", label: "Importar CSV" },
];

export function AdminNav() {
  const pathname = usePathname();
  // O item mais específico que casa com a rota atual fica ativo.
  const active = ITEMS.filter((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active === item.href ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            active === item.href && "bg-accent text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
