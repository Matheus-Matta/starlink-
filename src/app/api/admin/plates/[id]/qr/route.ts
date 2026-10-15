import { z } from "zod";

import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { handler, NO_STORE, parseParam } from "@/server/http";
import { requireAdminApi } from "@/server/security/guards";
import { publicUrl, renderQr } from "@/server/services/qr-service";

const querySchema = z.object({ format: z.enum(["svg", "png"]).default("svg"), download: z.enum(["0", "1"]).default("0") });

export const GET = handler<RouteContext<"/api/admin/plates/[id]/qr">>("plates.qr", async (request, { params }) => {
  await requireAdminApi(request);
  const id = parseParam(idSchema, (await params).id, "Placa");
  const { format, download } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const app = await getApp();
  const plate = app.plates.get(id);
  const body = await renderQr(publicUrl(app.config.publicBaseUrl, plate), format);
  const headers: Record<string, string> = {
    ...NO_STORE,
    "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
    // SVG gerado por nós; ainda assim, impede execução de scripts se aberto diretamente.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
  };
  if (download === "1") headers["Content-Disposition"] = `attachment; filename="placa-${plate.code}-qr.${format}"`;
  return new Response(new Uint8Array(body), { headers });
});
