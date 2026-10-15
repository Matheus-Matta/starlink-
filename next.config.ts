import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/** Cabeçalhos aplicados a todas as respostas. A CSP (com nonce) é definida em src/proxy.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Build autocontido apenas na imagem Docker (o Dockerfile define STANDALONE=1); `npm start` usa o build normal.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  // Binário nativo do Argon2: carregado pelo Node em runtime, sem passar pelo bundler.
  serverExternalPackages: ["@node-rs/argon2"],
  // Origens extras liberadas no `next dev` (ex.: acesso pelo IP da rede local/VPN).
  // Sem isso, o Next 16 bloqueia os recursos de dev e a página não hidrata (botões sem ação).
  allowedDevOrigins: ["26.164.133.87"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
