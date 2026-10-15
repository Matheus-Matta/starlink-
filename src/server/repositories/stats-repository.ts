import "server-only";

import type { AccessCounts, StatsMonth } from "@/types/domain";
import type { FileStore } from "@/server/repositories/file-store";

/** Contagens agregadas por mês ("YYYY-MM"), um arquivo criptografado por mês. */
export class StatsRepository {
  private readonly months = new Map<string, StatsMonth>();

  constructor(private readonly store: FileStore) {}

  async load(): Promise<string[]> {
    const { records, corrupt } = await this.store.readAll<StatsMonth & { month: string }>("stats");
    this.months.clear();
    for (const record of records) this.months.set(record.month, { counts: record.counts });
    return corrupt;
  }

  allCounts(): AccessCounts[] {
    return [...this.months.values()].map((m) => m.counts);
  }

  /** Soma os incrementos ao mês e grava o arquivo inteiro do mês (atômico). */
  async addToMonth(month: string, increments: AccessCounts): Promise<void> {
    const current = this.months.get(month) ?? { counts: {} };
    const counts: AccessCounts = { ...current.counts };
    for (const [key, value] of Object.entries(increments)) counts[key] = (counts[key] ?? 0) + value;
    await this.store.write("stats", month, { month, counts });
    this.months.set(month, { counts });
  }
}
