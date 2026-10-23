import { clientRoutingUpdateSchema, idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireClientApi } from "@/server/security/guards";

export const PATCH = handler<RouteContext<"/api/client/plates/[id]/routing">>("client.plates.routing", async (request, { params }) => {
  const session = await requireClientApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const app = await getApp();
  const plate = await app.plates.updateClientRouting(session.clientId, id, await readJson(request, clientRoutingUpdateSchema));
  return json({ plate });
});
