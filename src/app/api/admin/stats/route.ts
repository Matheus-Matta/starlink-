import { statsQuerySchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";

export const GET = handler("stats.query", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  const query = statsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json({ stats: app.stats.query(query, app.plateRepository.list()) });
});
