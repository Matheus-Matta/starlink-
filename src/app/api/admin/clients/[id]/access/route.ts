import { clientAccessSchema, idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const PUT = handler<RouteContext<"/api/admin/clients/[id]/access">>("clients.access", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Cliente");
  const app = await getApp();
  return json({ access: await app.credentials.configure(id, await readJson(request, clientAccessSchema)) });
});
