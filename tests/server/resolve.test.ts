import { describe, expect, it } from "vitest";

import { effectiveTarget, pageIsPublished, resolveAccess } from "@/server/redirects/resolve";
import type { Plate, Schedule } from "@/types/domain";

const at = (iso: string) => new Date(iso);

function plate(overrides: Partial<Plate> = {}): Plate {
  return {
    id: "p1",
    version: 1,
    sequence: 1,
    code: "1",
    previousCodes: [],
    clientId: "c1",
    name: "Placa",
    serialNumber: null,
    type: "QR_NFC",
    status: "active",
    routing: {
      active: true,
      target: { kind: "url", url: "https://padrao.com/" },
      page: { title: "Links", description: null, buttons: [{ id: "b1", label: "Insta", url: "https://instagram.com/", active: true }] },
    },
    schedules: [],
    history: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: "s1",
    target: { kind: "url", url: "https://agendado.com/" },
    startsAt: "2026-02-01T12:00:00.000Z",
    endsAt: null,
    timeZone: "America/Sao_Paulo",
    note: null,
    createdAt: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveAccess", () => {
  it("redireciona para o destino da placa", () => {
    expect(resolveAccess(plate(), at("2026-01-05T00:00:00Z"))).toEqual({ outcome: "redirect", url: "https://padrao.com/" });
  });

  it("trata arquivada, inativa e sem destino", () => {
    const now = at("2026-01-05T00:00:00Z");
    expect(resolveAccess(plate({ status: "archived" }), now)).toMatchObject({ reason: "archived" });
    expect(resolveAccess(plate({ routing: { ...plate().routing, active: false } }), now)).toMatchObject({ reason: "inactive" });
    expect(resolveAccess(plate({ routing: { ...plate().routing, target: { kind: "none" } } }), now)).toMatchObject({ reason: "no-target" });
  });

  it("página sem botões ativos não é publicada", () => {
    const routing = { ...plate().routing, target: { kind: "page" as const }, page: { title: "T", description: null, buttons: [] } };
    expect(resolveAccess(plate({ routing }), at("2026-01-05T00:00:00Z"))).toMatchObject({ reason: "no-target" });
    expect(pageIsPublished(plate({ routing }), at("2026-01-05T00:00:00Z"))).toBe(false);
  });
});

describe("agendamentos", () => {
  it("aplica a partir do início (inclusive) e volta ao padrão após o término (exclusive)", () => {
    const p = plate({ schedules: [schedule({ endsAt: "2026-02-02T12:00:00.000Z" })] });
    expect(resolveAccess(p, at("2026-02-01T11:59:59Z"))).toMatchObject({ url: "https://padrao.com/" });
    expect(resolveAccess(p, at("2026-02-01T12:00:00Z"))).toMatchObject({ url: "https://agendado.com/" });
    expect(resolveAccess(p, at("2026-02-02T11:00:00Z"))).toMatchObject({ url: "https://agendado.com/" });
    expect(resolveAccess(p, at("2026-02-02T12:00:00Z"))).toMatchObject({ url: "https://padrao.com/" });
  });

  it("em sobreposição vence o início mais recente; empates são determinísticos", () => {
    const older = schedule({ id: "a", startsAt: "2026-02-01T00:00:00.000Z", target: { kind: "url", url: "https://antigo.com/" } });
    const newer = schedule({ id: "b", startsAt: "2026-02-05T00:00:00.000Z", target: { kind: "url", url: "https://novo.com/" } });
    const now = at("2026-02-10T00:00:00Z");
    // A ordem de inserção não importa.
    expect(resolveAccess(plate({ schedules: [older, newer] }), now)).toMatchObject({ url: "https://novo.com/" });
    expect(resolveAccess(plate({ schedules: [newer, older] }), now)).toMatchObject({ url: "https://novo.com/" });

    const tieA = schedule({ id: "x", createdAt: "2026-01-01T00:00:00.000Z", target: { kind: "url", url: "https://x.com/" } });
    const tieB = schedule({ id: "y", createdAt: "2026-01-02T00:00:00.000Z", target: { kind: "url", url: "https://y.com/" } });
    expect(effectiveTarget(plate({ schedules: [tieA, tieB] }), now).schedule?.id).toBe("y");
    expect(effectiveTarget(plate({ schedules: [tieB, tieA] }), now).schedule?.id).toBe("y");
  });

  it("agendamento pode publicar a página de múltiplos links", () => {
    const p = plate({ schedules: [schedule({ target: { kind: "page" } })] });
    expect(resolveAccess(p, at("2026-03-01T00:00:00Z"))).toEqual({ outcome: "page" });
    expect(pageIsPublished(p, at("2026-03-01T00:00:00Z"))).toBe(true);
    expect(pageIsPublished(p, at("2026-01-01T00:00:00Z"))).toBe(false);
  });
});
