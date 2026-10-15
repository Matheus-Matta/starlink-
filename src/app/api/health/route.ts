import { getApp } from "@/server/container";
import { json } from "@/server/http";
import { errorSummary, log } from "@/server/logger";

/** Health check para o Docker/monitoramento. Não expõe dados nem nomes de arquivos. */
export async function GET() {
  try {
    const app = await getApp();
    const degraded = app.health.corruptFiles.length > 0;
    return json(
      { status: degraded ? "degraded" : "ok", startedAt: app.health.startedAt, corruptFiles: app.health.corruptFiles.length },
      { status: degraded ? 503 : 200 },
    );
  } catch (error) {
    log("error", "health.failed", errorSummary(error));
    return json({ status: "error" }, { status: 503 });
  }
}
