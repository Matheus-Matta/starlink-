import "server-only";

import { dayInTimeZone } from "@/lib/timezone";
import type { AccessCounts, Plate } from "@/types/domain";
import { Mutex } from "@/server/concurrency";
import { errorSummary, log } from "@/server/logger";
import type { StatsRepository } from "@/server/repositories/stats-repository";

export type StatsQuery = {
  /** Dias civis inclusivos ("YYYY-MM-DD") no fuso da aplicação. */
  from: string;
  to: string;
  clientId?: string;
  plateId?: string;
};

export type StatsResult = {
  total: number;
  byDay: Array<{ day: string; total: number }>;
  topPlates: Array<{ plateId: string; total: number }>;
};

const keyOf = (day: string, plateId: string) => `${day}|${plateId}`;

/**
 * Estatísticas com baixo I/O: cada acesso só incrementa um contador em memória;
 * os contadores são gravados em lote periodicamente (e no encerramento do processo).
 * Não armazena IP, user-agent nem qualquer dado do visitante.
 */
export class StatsService {
  private pending: AccessCounts = {};
  private readonly flushMutex = new Mutex();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly repo: StatsRepository,
    private readonly timeZone: string,
    private readonly flushIntervalMs: number,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  record(plateId: string, now: Date): void {
    const key = keyOf(dayInTimeZone(now, this.timeZone), plateId);
    this.pending[key] = (this.pending[key] ?? 0) + 1;
  }

  /** Grava os contadores pendentes. Em caso de falha, devolve-os à fila para a próxima tentativa. */
  flush(): Promise<void> {
    return this.flushMutex.run(async () => {
      const snapshot = this.pending;
      if (Object.keys(snapshot).length === 0) return;
      this.pending = {};

      const byMonth = new Map<string, AccessCounts>();
      for (const [key, value] of Object.entries(snapshot)) {
        const month = key.slice(0, 7);
        const bucket = byMonth.get(month) ?? {};
        bucket[key] = value;
        byMonth.set(month, bucket);
      }
      for (const [month, increments] of byMonth) {
        try {
          await this.repo.addToMonth(month, increments);
        } catch (error) {
          for (const [key, value] of Object.entries(increments)) this.pending[key] = (this.pending[key] ?? 0) + value;
          log("error", "stats.flush_failed", { month, ...errorSummary(error) });
        }
      }
    });
  }

  query(query: StatsQuery, plates: Plate[]): StatsResult {
    const clientOf = new Map(plates.map((p) => [p.id, p.clientId]));
    const byDay = new Map<string, number>();
    const byPlate = new Map<string, number>();
    let total = 0;

    const consider = (counts: AccessCounts) => {
      for (const [key, value] of Object.entries(counts)) {
        // Registros antigos têm um 3º campo (canal QR/NFC), que é ignorado.
        const [day, plateId] = key.split("|") as [string, string];
        if (day < query.from || day > query.to) continue;
        if (query.plateId && plateId !== query.plateId) continue;
        if (query.clientId && clientOf.get(plateId) !== query.clientId) continue;
        byDay.set(day, (byDay.get(day) ?? 0) + value);
        byPlate.set(plateId, (byPlate.get(plateId) ?? 0) + value);
        total += value;
      }
    };
    for (const counts of this.repo.allCounts()) consider(counts);
    consider(this.pending);

    return {
      total,
      byDay: fillDays(query.from, query.to).map((day) => ({ day, total: byDay.get(day) ?? 0 })),
      topPlates: [...byPlate.entries()]
        .map(([plateId, total]) => ({ plateId, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    };
  }
}

/** Lista todos os dias entre `from` e `to` (inclusive), limitada a 366 dias. */
function fillDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end && days.length < 366) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
