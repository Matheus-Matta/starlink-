import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getApp } from "@/server/container";
import { sessionCookieName } from "@/server/security/guards";

export default async function Home() {
  const app = await getApp();
  const token = (await cookies()).get(sessionCookieName(app.config))?.value;
  const session = app.sessions.get(token);
  redirect(session?.role === "client" ? "/cliente" : "/admin");
}
