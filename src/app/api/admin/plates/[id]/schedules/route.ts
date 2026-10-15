import { idSchema, scheduleCreateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const POST = handler<RouteContext<"/api/admin/plates/[id]/schedules">>("plates.schedule_add", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const app = await getApp();
  return json({ plate: await app.plates.addSchedule(id, await readJson(request, scheduleCreateSchema)) }, { status: 201 });
});
