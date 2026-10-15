export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Diferença (ms) entre o horário de parede no fuso e UTC, no instante informado. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Converte um horário de parede ("YYYY-MM-DDTHH:mm", como em <input type="datetime-local">)
 * no fuso IANA informado para um instante UTC. Retorna `null` se a entrada for inválida.
 * Em horários inexistentes/ambíguos (transições de horário de verão), usa o offset vigente
 * após a transição, de forma determinística.
 */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = LOCAL_RE.exec(local);
  if (!m || !isValidTimeZone(timeZone)) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map((v) => Number(v ?? 0)) as [
    number, number, number, number, number, number,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;

  // Duas iterações resolvem o offset corretamente mesmo perto de transições.
  let guess = wall - offsetAt(wall, timeZone);
  guess = wall - offsetAt(guess, timeZone);
  return new Date(guess);
}

/** Formata um instante como "YYYY-MM-DDTHH:mm" no fuso (para preencher inputs). */
export function utcToZonedLocal(instant: Date, timeZone: string): string {
  const shifted = new Date(instant.getTime() + offsetAt(instant.getTime(), timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** Dia civil ("YYYY-MM-DD") do instante no fuso informado. */
export function dayInTimeZone(instant: Date, timeZone: string): string {
  return utcToZonedLocal(instant, timeZone).slice(0, 10);
}

/** Formata data/hora para exibição em pt-BR no fuso informado. */
export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
}
