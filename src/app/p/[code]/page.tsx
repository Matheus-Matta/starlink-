import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";

import { normalizePlateCode } from "@/lib/plate-code";
import { getApp } from "@/server/container";
import { pageIsPublished } from "@/server/redirects/resolve";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Página pública de múltiplos links. Todo conteúdo vem do registro como TEXTO
 * (o React escapa tudo); URLs foram validadas como http/https na gravação.
 */
export default async function LinkPage({ params }: PageProps<"/p/[code]">) {
  const code = normalizePlateCode((await params).code);
  const app = await getApp();
  const plate = code ? app.plateRepository.getByCode(code) : undefined;
  if (!plate || !pageIsPublished(plate, new Date())) notFound();

  const { title, description, buttons } = plate.routing.page;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 whitespace-pre-line">{description}</p>}
        <ul className="mt-8 grid gap-3">
          {buttons
            .filter((b) => b.active)
            .map((button) => (
              <li key={button.id}>
                <a
                  href={button.url}
                  rel="noopener noreferrer nofollow"
                  className="bg-primary text-primary-foreground focus-visible:ring-ring flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {button.label}
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                </a>
              </li>
            ))}
        </ul>
        <p className="text-muted-foreground mt-10 text-xs">
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </div>
    </main>
  );
}
