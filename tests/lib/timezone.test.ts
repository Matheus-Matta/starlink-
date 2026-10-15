import { describe, expect, it } from "vitest";

import { dayInTimeZone, utcToZonedLocal, zonedLocalToUtc } from "@/lib/timezone";

describe("fusos horários", () => {
  it("converte horário de parede de São Paulo (UTC-3) para UTC", () => {
    expect(zonedLocalToUtc("2026-03-10T09:00", "America/Sao_Paulo")?.toISOString()).toBe("2026-03-10T12:00:00.000Z");
  });

  it("considera horário de verão em outros fusos", () => {
    expect(zonedLocalToUtc("2026-07-01T12:00", "Europe/Lisbon")?.toISOString()).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedLocalToUtc("2026-01-01T12:00", "Europe/Lisbon")?.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("é determinístico em horários inexistentes (salto de horário de verão)", () => {
    const a = zonedLocalToUtc("2026-03-08T02:30", "America/New_York");
    const b = zonedLocalToUtc("2026-03-08T02:30", "America/New_York");
    expect(a).not.toBeNull();
    expect(a?.getTime()).toBe(b?.getTime());
  });

  it("rejeita datas e fusos inválidos", () => {
    expect(zonedLocalToUtc("2026-02-30T10:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedLocalToUtc("2026-01-01T10:00", "Marte/Olympus")).toBeNull();
    expect(zonedLocalToUtc("ontem", "UTC")).toBeNull();
  });

  it("faz o caminho inverso e calcula o dia civil", () => {
    const instant = new Date("2026-03-10T02:30:00Z"); // 23:30 do dia 9 em São Paulo
    expect(utcToZonedLocal(instant, "America/Sao_Paulo")).toBe("2026-03-09T23:30");
    expect(dayInTimeZone(instant, "America/Sao_Paulo")).toBe("2026-03-09");
    expect(dayInTimeZone(instant, "UTC")).toBe("2026-03-10");
  });
});
