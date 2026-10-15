import { idSchema, plateCreateSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const GET = handler("plates.list", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  const params = new URL(request.url).searchParams;
  const clientId = idSchema.safeParse(params.get("clientId"));
  const plates = app.plates.list({
    q: params.get("q") ?? undefined,
    clientId: clientId.success ? clientId.data : undefined,
    includeArchived: params.get("archived") === "1",
  });
  return json({ plates });
});

export const POST = handler("plates.create", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  const plate = await app.plates.create(await readJson(request, plateCreateSchema));
  return json({ plate }, { status: 201 });
});
