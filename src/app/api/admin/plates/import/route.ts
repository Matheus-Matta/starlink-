import { importRequestSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, json, readJson } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";
import { MAX_IMPORT_BYTES } from "@/server/services/import-service";

export const POST = handler("plates.import", async (request) => {
  await requireAdminApi(request);
  const app = await getApp();
  // Margem para o envelope JSON e o escape de caracteres do CSV; o CSV em si é limitado no serviço.
  const { mode, csv } = await readJson(request, importRequestSchema, MAX_IMPORT_BYTES * 2);
  if (mode === "preview") return json({ preview: app.imports.preview(csv), created: 0 });
  const { preview, created } = await app.imports.commit(csv);
  return json({ preview, created: created.length }, { status: 201 });
});
