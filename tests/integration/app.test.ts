import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clientCreateSchema, plateCreateSchema, plateUpdateSchema, routingUpdateSchema, scheduleCreateSchema } from "@/lib/validation";
import { createApp, type App } from "@/server/container";
import { AppError } from "@/server/errors";
import { resolveAccess } from "@/server/redirects/resolve";
import { FileStore } from "@/server/repositories/file-store";
import type { AppConfig } from "@/server/config";
import type { Plate } from "@/types/domain";
import { makeConfig, makeTempDir } from "../helpers/app";

let dir: string;
let cleanup: () => Promise<void>;
let config: AppConfig;
let app: App;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  config = makeConfig(dir);
  app = await createApp(config);
});
afterEach(async () => {
  app.stats.stop();
  await cleanup();
});

async function seedClient() {
  return app.clients.create(clientCreateSchema.parse({ name: "Padaria Pão Quente", document: "11.222.333/0001-81" }));
}

async function seedPlate(destination = "https://destino.com/") {
  const client = await seedClient();
  const plate = await app.plates.create(
    plateCreateSchema.parse({ clientId: client.id, name: "Balcão", type: "QR_NFC", destinationUrl: destination }),
  );
  return { client, plate };
}

const editCode = (plate: Plate, code: string) =>
  app.plates.update(plate.id, plateUpdateSchema.parse({ ...plate, code, version: plate.version }));

describe("fluxo de clientes e placas", () => {
  it("persiste criptografado e recarrega após reinício", async () => {
    const { client, plate } = await seedPlate();

    const raw = await readFile(path.join(dir, "data", "clients", `${client.id}.enc`));
    expect(raw.includes(Buffer.from("Padaria"))).toBe(false);

    const restarted = await createApp(config);
    expect(restarted.clients.get(client.id).name).toBe("Padaria Pão Quente");
    expect(restarted.plateRepository.getByCode(plate.code)?.id).toBe(plate.id);
    expect(restarted.health.corruptFiles).toEqual([]);
  });

  it("rejeita CPF/CNPJ duplicado e placas para cliente arquivado", async () => {
    const { client } = await seedPlate();
    await expect(app.clients.create(clientCreateSchema.parse({ name: "Outro", document: "11222333000181" }))).rejects.toThrow(/CPF\/CNPJ/);

    const archived = await app.clients.setStatus(client.id, "archived", client.version);
    expect(archived.status).toBe("archived");
    await expect(
      app.plates.create(plateCreateSchema.parse({ clientId: client.id, name: "Nova", type: "QR" })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("detecta edição concorrente (versão desatualizada) e serializa gravações", async () => {
    const { client } = await seedPlate();
    const input = { ...clientCreateSchema.parse({ name: "A" }), version: client.version };
    const results = await Promise.allSettled([
      app.clients.update(client.id, { ...input, name: "Primeira" }),
      app.clients.update(client.id, { ...input, name: "Segunda" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AppError);
    expect((rejected.reason as AppError).code).toBe("CONFLICT");
    expect(app.clients.get(client.id).version).toBe(client.version + 1);
  });

  it("anonimiza dados pessoais apenas de clientes arquivados", async () => {
    const { client } = await seedPlate();
    await expect(app.clients.anonymize(client.id, client.version)).rejects.toThrow(/Arquive/);
    const archived = await app.clients.setStatus(client.id, "archived", client.version);
    const anonymized = await app.clients.anonymize(client.id, archived.version);
    expect(anonymized).toMatchObject({ document: null, email: null, anonymized: true });
    expect(anonymized.name).not.toContain("Padaria");
  });
});

describe("código do link (/r/<código>)", () => {
  it("numera as placas em sequência: 1, 2, 3…", async () => {
    const client = await seedClient();
    const create = (name: string) => app.plates.create(plateCreateSchema.parse({ clientId: client.id, name, type: "QR" }));
    const codes = [(await create("A")).code, (await create("B")).code, (await create("C")).code];
    expect(codes).toEqual(["1", "2", "3"]);
  });

  it("permite trocar o código; o antigo continua apontando para a placa e fica reservado", async () => {
    const { client, plate } = await seedPlate();
    const changed = await editCode(plate, "Loja-Centro");
    expect(changed.code).toBe("loja-centro");
    expect(changed.previousCodes).toEqual(["1"]);
    expect(app.plateRepository.getByCode("1")?.id).toBe(plate.id);
    expect(changed.history.at(-1)).toMatchObject({ field: "code", before: "1", after: "loja-centro" });

    // A próxima placa não reaproveita o "1" (reservado) e recebe o 2.
    const next = await app.plates.create(plateCreateSchema.parse({ clientId: client.id, name: "Nova", type: "NFC" }));
    expect(next.code).toBe("2");

    // Ninguém pode usar código atual ou anterior de outra placa.
    await expect(editCode(next, "loja-centro")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(editCode(next, "1")).rejects.toMatchObject({ code: "VALIDATION" });

    // A própria placa pode voltar ao código anterior.
    const back = await editCode(changed, "1");
    expect(back).toMatchObject({ code: "1", previousCodes: ["loja-centro"] });
  });

  it("pula números já usados manualmente na sequência", async () => {
    const { client, plate } = await seedPlate();
    await editCode(plate, "2");
    const next = await app.plates.create(plateCreateSchema.parse({ clientId: client.id, name: "Nova", type: "QR" }));
    expect(next.code).toBe("3"); // "1" é código antigo e "2" está em uso
  });

  it("migra placas do formato antigo (código aleatório, destinos QR/NFC) mantendo o código antigo", async () => {
    const client = await seedClient();
    const store = new FileStore(dir, config.dataKey);
    const legacyId = randomUUID();
    await store.write("plates", legacyId, {
      id: legacyId,
      version: 3,
      publicCode: "KSY9XJ53CG5Y",
      clientId: client.id,
      name: "Antiga",
      serialNumber: null,
      type: "QR_NFC",
      status: "active",
      routing: {
        active: true,
        qr: { kind: "url", url: "https://antigo-qr.com/" },
        nfc: { kind: "url", url: "https://antigo-nfc.com/" },
        page: { title: "Antiga", description: null, buttons: [] },
      },
      schedules: [],
      history: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const restarted = await createApp(config);
    const migrated = restarted.plateRepository.get(legacyId)!;
    expect(migrated).toMatchObject({ sequence: 1, code: "1", previousCodes: ["ksy9xj53cg5y"] });
    expect(migrated.routing.target).toEqual({ kind: "url", url: "https://antigo-qr.com/" });
    expect(restarted.plateRepository.getByCode("ksy9xj53cg5y")?.id).toBe(legacyId);

    // Persistiu a migração: um novo reinício não renumera.
    const again = await createApp(config);
    expect(again.plateRepository.get(legacyId)?.code).toBe("1");
  });
});

describe("destino, histórico e agendamentos", () => {
  it("troca o destino mantendo o link e registra o histórico", async () => {
    const { plate } = await seedPlate();
    const updated = await app.plates.updateRouting(
      plate.id,
      routingUpdateSchema.parse({
        version: plate.version,
        active: true,
        target: { kind: "page" },
        page: { title: "Nossos links", description: "", buttons: [{ label: "WhatsApp", url: "https://wa.me/55119", active: true }] },
      }),
    );
    expect(updated.code).toBe(plate.code);
    expect(resolveAccess(updated, new Date())).toEqual({ outcome: "page" });

    const changes = updated.history.filter((h) => h.action === "link-changed");
    expect(changes.map((h) => h.field).sort()).toEqual(["page", "target"]);
    expect(changes.find((h) => h.field === "target")).toMatchObject({ before: "https://destino.com/", after: "Página de múltiplos links" });
  });

  it("agenda no fuso informado e rejeita agendamentos já expirados", async () => {
    const { plate } = await seedPlate();
    const withSchedule = await app.plates.addSchedule(
      plate.id,
      scheduleCreateSchema.parse({
        version: plate.version,
        target: { kind: "url", url: "https://promo.com" },
        startsAt: "2099-12-24T18:00",
        endsAt: "2099-12-26T00:00",
        timeZone: "America/Sao_Paulo",
        note: "Natal",
      }),
    );
    expect(withSchedule.schedules[0]).toMatchObject({ startsAt: "2099-12-24T21:00:00.000Z", endsAt: "2099-12-26T03:00:00.000Z" });
    expect(resolveAccess(withSchedule, new Date("2099-12-25T12:00:00Z"))).toMatchObject({ url: "https://promo.com/" });

    await expect(
      app.plates.addSchedule(
        plate.id,
        scheduleCreateSchema.parse({
          version: withSchedule.version,
          target: { kind: "none" },
          startsAt: "2000-01-01T00:00",
          endsAt: "2000-01-02T00:00",
          timeZone: "UTC",
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const removed = await app.plates.removeSchedule(plate.id, withSchedule.schedules[0].id, withSchedule.version);
    expect(removed.schedules).toEqual([]);
    expect(removed.history.at(-1)?.action).toBe("schedule-removed");
  });

  it("arquivar mantém o código reservado e torna o link indisponível", async () => {
    const { plate } = await seedPlate();
    const archived = await app.plates.setStatus(plate.id, "archived", plate.version);
    expect(resolveAccess(archived, new Date())).toMatchObject({ reason: "archived" });
    expect(app.plateRepository.isCodeTaken(plate.code)).toBe(true);
  });
});

describe("importação CSV", () => {
  it("prévia aponta erros por linha e o commit é tudo-ou-nada", async () => {
    const { client } = await seedPlate();
    const bad = [
      "cliente,nome,tipo,numero_serie,url_destino",
      `${client.id},Mesa 1,QR,SN1,https://ok.com`,
      "99.999.999/9999-99,Mesa 2,QR,,https://ok.com",
      `${client.id},,NFC,,javascript:alert(1)`,
    ].join("\n");
    const preview = app.imports.preview(bad);
    expect(preview).toMatchObject({ validCount: 1, errorCount: 2 });
    expect(preview.rows[1].errors.join()).toMatch(/Cliente/);
    expect(preview.rows[2].errors.join()).toMatch(/nome/);
    await expect(app.imports.commit(bad)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(app.plates.list()).toHaveLength(1); // só a placa do seed

    const good = ["cliente;nome;tipo", "11.222.333/0001-81;Mesa 1;QR", "11222333000181;Mesa 2;QR+NFC"].join("\n");
    const { created } = await app.imports.commit(good);
    expect(created.map((p) => [p.code, p.type])).toEqual([
      ["2", "QR"],
      ["3", "QR_NFC"],
    ]);
  });

  it("rejeita arquivos sem as colunas obrigatórias ou grandes demais", async () => {
    expect(app.imports.preview("a,b\n1,2").fileErrors.join()).toMatch(/cliente/);
    expect(() => app.imports.preview("x".repeat(600 * 1024))).toThrow(/excede/);
  });
});

describe("estatísticas", () => {
  it("agrega em memória, grava em lote por mês e sobrevive a reinício", async () => {
    const { plate } = await seedPlate();
    const day = new Date("2026-05-10T15:00:00Z");
    for (let i = 0; i < 4; i++) app.stats.record(plate.id, day);
    app.stats.record(plate.id, new Date("2026-06-01T02:00:00Z")); // 31/05 em São Paulo

    // Antes do flush já aparece na consulta (pendente em memória), sem arquivo gravado.
    expect(await readdir(path.join(dir, "stats"))).toEqual([]);
    const q = { from: "2026-05-01", to: "2026-05-31" };
    expect(app.stats.query(q, app.plateRepository.list()).total).toBe(5);

    await app.stats.flush();
    expect((await readdir(path.join(dir, "stats"))).sort()).toEqual(["2026-05.enc"]);

    const restarted = await createApp(config);
    const result = restarted.stats.query(q, restarted.plateRepository.list());
    expect(result.total).toBe(5);
    expect(result.byDay.find((d) => d.day === "2026-05-31")).toMatchObject({ total: 1 });
    expect(restarted.stats.query({ ...q, clientId: "00000000-0000-4000-8000-000000000000" }, restarted.plateRepository.list()).total).toBe(0);
  });

  it("soma contagens antigas que ainda tinham o canal QR/NFC", async () => {
    const { plate } = await seedPlate();
    const store = new FileStore(dir, config.dataKey);
    await store.write("stats", "2026-04", { month: "2026-04", counts: { [`2026-04-02|${plate.id}|qr`]: 3, [`2026-04-02|${plate.id}|nfc`]: 2 } });
    const restarted = await createApp(config);
    expect(restarted.stats.query({ from: "2026-04-01", to: "2026-04-30" }, restarted.plateRepository.list()).total).toBe(5);
  });
});
