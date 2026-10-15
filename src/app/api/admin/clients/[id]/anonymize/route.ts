import { idSchema, versionOnlySchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, parseParam, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const POST = handler<RouteContext<"/api/admin/clients/[id]/anonymize">>("clients.anonymize", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Cliente");
  const { version } = await readJson(request, versionOnlySchema);
  const app = await getApp();
  return json({ client: await app.clients.anonymize(id, version) });
});
