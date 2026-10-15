import { idSchema, statusUpdateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const POST = handler<RouteContext<"/api/admin/plates/[id]/status">>("plates.status", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const { status, version } = await readJson(request, statusUpdateSchema);
  const app = await getApp();
  return json({ plate: await app.plates.setStatus(id, status, version) });
});
