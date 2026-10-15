import { clientCreateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const GET = handler("clients.list", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  const params = new URL(request.url).searchParams;
  const clients = app.clients.list({ q: params.get("q") ?? undefined, includeArchived: params.get("archived") === "1" });
  return json({ clients });
});

export const POST = handler("clients.create", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  const client = await app.clients.create(await readJson(request, clientCreateSchema));
  return json({ client }, { status: 201 });
});
