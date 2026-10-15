import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Login from "@/components/shadcn-studio/blocks/login-page-01/login-page-01";
import { getApp } from "@/server/container";
import { sessionCookieName } from "@/server/security/guards";

export const metadata: Metadata = {
  title: "Entrar | Starlink",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const app = await getApp();
  const token = (await cookies()).get(sessionCookieName(app.config))?.value;
  if (app.sessions.get(token)) redirect("/admin");
  return <Login />;
}
