import { cookies } from "next/headers";

import { getApp } from "@/server/container";
import { handler, json } from "@/server/http";
import { assertSameOrigin, sessionCookieName } from "@/server/security/guards";

export const POST = handler("auth.logout", async (request) => {
  const app = await getApp();
  assertSameOrigin(request, app.config);
  const store = await cookies();
  const name = sessionCookieName(app.config);
  app.auth.logout(store.get(name)?.value);
  store.delete(name);
  return json({ ok: true });
});
