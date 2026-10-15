import type { Metadata } from "next";
import { headers } from "next/headers";

import { ThemeProvider } from "@/components/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Starlink",
  description: "Administração de placas dinâmicas com QR Code e NFC",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce da CSP gerado em src/proxy.ts; autoriza o script inline de tema.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: o script de tema ajusta a classe do <html> antes da hidratação.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
