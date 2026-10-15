import type { Plate, Schedule, Target } from "@/types/domain";

export type Resolution =
  | { outcome: "redirect"; url: string }
  | { outcome: "page" }
  | { outcome: "unavailable"; reason: "archived" | "inactive" | "no-target" };

export function scheduleIsActive(schedule: Schedule, now: Date): boolean {
  const t = now.getTime();
  if (Date.parse(schedule.startsAt) > t) return false;
  return schedule.endsAt === null || Date.parse(schedule.endsAt) > t;
}

/**
 * Ordem determinística entre agendamentos ativos: `startsAt` mais recente vence;
 * empate → `createdAt` mais recente; empate → maior `id`.
 */
function compareSchedules(a: Schedule, b: Schedule): number {
  return (
    Date.parse(b.startsAt) - Date.parse(a.startsAt) ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

/** Destino efetivo da placa no instante `now`, considerando agendamentos. */
export function effectiveTarget(plate: Plate, now: Date): { target: Target; schedule: Schedule | null } {
  const winner = plate.schedules.filter((s) => scheduleIsActive(s, now)).sort(compareSchedules)[0] ?? null;
  return { target: winner ? winner.target : plate.routing.target, schedule: winner };
}

/**
 * Resolve o acesso à URL pública da placa (a mesma para QR Code e NFC). Função pura:
 * depende apenas do registro e do relógio, então o resultado é o mesmo após reinícios.
 */
export function resolveAccess(plate: Plate, now: Date): Resolution {
  if (plate.status === "archived") return { outcome: "unavailable", reason: "archived" };
  if (!plate.routing.active) return { outcome: "unavailable", reason: "inactive" };

  const { target } = effectiveTarget(plate, now);
  if (target.kind === "url") return { outcome: "redirect", url: target.url };
  if (target.kind === "page") {
    const hasButtons = plate.routing.page.buttons.some((b) => b.active);
    return hasButtons ? { outcome: "page" } : { outcome: "unavailable", reason: "no-target" };
  }
  return { outcome: "unavailable", reason: "no-target" };
}

/** A página de múltiplos links só é pública enquanto for o destino em vigor. */
export function pageIsPublished(plate: Plate, now: Date): boolean {
  return resolveAccess(plate, now).outcome === "page";
}
