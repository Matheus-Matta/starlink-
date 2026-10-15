import { idSchema, routingUpdateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const PUT = handler<RouteContext<"/api/admin/plates/[id]/routing">>("plates.routing", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const app = await getApp();
  return json({ plate: await app.plates.updateRouting(id, await readJson(request, routingUpdateSchema)) });
});
