import { z } from "zod";

import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

type Ctx = RouteContext<"/api/admin/plates/[id]/schedules/[scheduleId]">;

export const DELETE = handler<Ctx>("plates.schedule_remove", async (request, { params }) => {
  await requireAdminApi(request);
  const { id, scheduleId } = await params;
  const plateId = parseParam(idSchema, id, "Placa");
  const schedule = parseParam(idSchema, scheduleId, "Agendamento");
  const version = z.coerce.number().int().min(1).parse(new URL(request.url).searchParams.get("version"));
  const app = await getApp();
  return json({ plate: await app.plates.removeSchedule(plateId, schedule, version) });
});
