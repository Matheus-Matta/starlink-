import { idSchema, plateUpdateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

type Ctx = RouteContext<"/api/admin/plates/[id]">;

export const GET = handler<Ctx>("plates.get", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const app = await getApp();
  return json({ plate: app.plates.get(id) });
});

export const PATCH = handler<Ctx>("plates.update", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const app = await getApp();
  return json({ plate: await app.plates.update(id, await readJson(request, plateUpdateSchema)) });
});
