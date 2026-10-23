import type { Metadata } from "next";
import Link from "next/link";

import { CsrfProvider } from "@/components/admin/csrf-context";
import { LogoutButton } from "@/components/admin/logout-button";
import Logo from "@/components/shadcn-studio/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getApp } from "@/server/container";
import { requireClientPage } from "@/server/security/guards";

export const metadata: Metadata = {
  title: { default: "Portal do cliente | Starlink", template: "%s | Starlink" },
  robots: { index: false, follow: false },
};

export default async function ClientLayout({ children }: LayoutProps<"/cliente">) {
  const session = await requireClientPage();
  const app = await getApp();
  const client = app.clients.get(session.clientId);

  return (
    <CsrfProvider token={session.csrfToken}>
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/cliente" aria-label="Início do portal"><Logo className="[&_span:last-child]:text-lg" /></Link>
          <div className="min-w-0 flex-1 border-l pl-4">
            <p className="text-muted-foreground text-xs">Portal do cliente</p>
            <p className="truncate text-sm font-medium">{client.tradeName ?? client.name}</p>
          </div>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </CsrfProvider>
  );
}
