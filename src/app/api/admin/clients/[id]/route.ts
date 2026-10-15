import { clientUpdateSchema, idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

type Ctx = RouteContext<"/api/admin/clients/[id]">;

export const GET = handler<Ctx>("clients.get", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Cliente");
  const app = await getApp();
  return json({ client: app.clients.get(id) });
});

export const PATCH = handler<Ctx>("clients.update", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Cliente");
  const app = await getApp();
  const client = await app.clients.update(id, await readJson(request, clientUpdateSchema));
  return json({ client });
});
