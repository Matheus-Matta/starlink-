import { idSchema, statusUpdateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const POST = handler<RouteContext<"/api/admin/clients/[id]/status">>("clients.status", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Cliente");
  const { status, version } = await readJson(request, statusUpdateSchema);
  const app = await getApp();
  return json({ client: await app.clients.setStatus(id, status, version) });
});
