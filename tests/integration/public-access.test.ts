import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clientCreateSchema, plateCreateSchema, plateUpdateSchema, routingUpdateSchema } from "@/lib/validation";
import { createApp, type App } from "@/server/container";
import { handlePublicAccess } from "@/server/redirects/public-access";
import { makeConfig, makeTempDir } from "../helpers/app";

let app: App;
let cleanup: () => Promise<void>;
const globalForApp = globalThis as typeof globalThis & { __starlinkApp?: Promise<App> };

beforeEach(async () => {
  const temp = await makeTempDir();
  cleanup = temp.cleanup;
  app = await createApp(makeConfig(temp.dir));
  globalForApp.__starlinkApp = Promise.resolve(app);
});
afterEach(async () => {
  globalForApp.__starlinkApp = undefined;
  await cleanup();
});

const request = () => new Request("https://placas.exemplo.com/r/1");

async function seed() {
  const client = await app.clients.create(clientCreateSchema.parse({ name: "Cliente" }));
  return app.plates.create(plateCreateSchema.parse({ clientId: client.id, name: "P", type: "QR_NFC", destinationUrl: "https://destino.com" }));
}

describe("link público /r/<código>", () => {
  it("redireciona com 302 sem cache e contabiliza o acesso", async () => {
    const plate = await seed();
    expect(plate.code).toBe("1");
    const response = await handlePublicAccess(request(), "1");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://destino.com/");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(app.stats.query({ from: "2000-01-01", to: "2999-12-31" }, app.plateRepository.list()).total).toBe(1);
  });

  it("a troca de destino vale no próximo acesso (sem 301/308 em cache)", async () => {
    const plate = await seed();
    await app.plates.updateRouting(
      plate.id,
      routingUpdateSchema.parse({ version: plate.version, active: true, target: { kind: "url", url: "https://novo.com" }, page: { title: "T", buttons: [] } }),
    );
    const response = await handlePublicAccess(request(), plate.code);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://novo.com/");
  });

  it("após trocar o código, o novo e o antigo funcionam", async () => {
    const plate = await seed();
    await app.plates.update(plate.id, plateUpdateSchema.parse({ ...plate, code: "Loja-Centro", version: plate.version }));
    expect((await handlePublicAccess(request(), "loja-centro")).status).toBe(302);
    expect((await handlePublicAccess(request(), "LOJA-CENTRO")).status).toBe(302);
    expect((await handlePublicAccess(request(), "1")).headers.get("location")).toBe("https://destino.com/");
  });

  it("responde 404 para código inexistente/inválido e 410 para placa arquivada", async () => {
    const plate = await seed();
    expect((await handlePublicAccess(request(), "999")).status).toBe(404);
    expect((await handlePublicAccess(request(), "<script>")).status).toBe(404);
    await app.plates.setStatus(plate.id, "archived", plate.version);
    const gone = await handlePublicAccess(request(), plate.code);
    expect(gone.status).toBe(410);
  });

  it("modo página redireciona para /p/<código>", async () => {
    const plate = await seed();
    await app.plates.updateRouting(
      plate.id,
      routingUpdateSchema.parse({
        version: plate.version,
        active: true,
        target: { kind: "page" },
        page: { title: "Links", buttons: [{ label: "Site", url: "https://site.com", active: true }] },
      }),
    );
    const response = await handlePublicAccess(request(), plate.code);
    expect(response.headers.get("location")).toBe("https://placas.exemplo.com/p/1");
  });

  it("limita varreduras por IP com 429", async () => {
    await seed();
    let last = 0;
    for (let i = 0; i < 125; i++) last = (await handlePublicAccess(request(), "1")).status;
    expect(last).toBe(429);
  });
});
