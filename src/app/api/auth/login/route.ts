import { cookies } from "next/headers";

import { loginSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, readJson } from "@/server/http";
import { assertSameOrigin, clientIp, sessionCookieName, sessionCookieOptions } from "@/server/security/guards";

export const POST = handler("auth.login", async (request) => {
  const app = await getApp();
  assertSameOrigin(request, app.config);
  const { identifier, password } = await readJson(request, loginSchema, 4 * 1024);
  const { token, session } = await app.auth.login(identifier, password, clientIp(request.headers, app.config));
  (await cookies()).set(sessionCookieName(app.config), token, sessionCookieOptions(app.config, session.expiresAt));
  return json({ ok: true, redirectTo: session.role === "admin" ? "/admin" : "/cliente" });
});
