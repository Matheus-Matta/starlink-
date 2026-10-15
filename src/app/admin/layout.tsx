import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { CsrfProvider } from "@/components/admin/csrf-context";
import { LogoutButton } from "@/components/admin/logout-button";
import Logo from "@/components/shadcn-studio/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAdminPage } from "@/server/security/guards";

export const metadata: Metadata = {
  title: { default: "Painel | Starlink", template: "%s | Starlink" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdminPage();

  return (
    <CsrfProvider token={session.csrfToken}>
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" aria-label="Início do painel">
            <Logo className="[&_span:last-child]:text-lg" />
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <AdminNav />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </CsrfProvider>
  );
}
