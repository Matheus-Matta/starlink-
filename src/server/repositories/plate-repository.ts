import "server-only";

import type { Plate, PlateRouting, Schedule, Target } from "@/types/domain";
import type { FileStore } from "@/server/repositories/file-store";

/**
 * Placas: um arquivo criptografado por placa (incluindo link, agendamentos e histórico),
 * para que toda mutação seja uma única gravação atômica.
 *
 * Mantém o índice de redirecionamento (código → placa) em memória, incluindo os códigos
 * anteriores de cada placa. Ele é derivado dos arquivos, reconstruído a cada `load()` e
 * atualizado somente após a gravação no disco.
 */
export class PlateRepository {
  private readonly byId = new Map<string, Plate>();
  private readonly byCode = new Map<string, Plate>();
  private maxSequence = 0;

  constructor(private readonly store: FileStore) {}

  async load(): Promise<string[]> {
    const { records, corrupt } = await this.store.readAll<Plate | LegacyPlate>("plates");
    this.byId.clear();
    this.byCode.clear();
    this.maxSequence = 0;

    const legacy: LegacyPlate[] = [];
    for (const record of records) {
      if (isLegacy(record)) legacy.push(record);
      else this.index(record, corrupt);
    }

    // Migração do formato antigo (código aleatório + destinos separados para QR/NFC):
    // recebe o próximo número sequencial e o código antigo continua funcionando.
    legacy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const old of legacy) {
      const sequence = this.nextSequence();
      const plate = migrateLegacyPlate(old, sequence);
      await this.store.write("plates", plate.id, plate);
      this.index(plate, corrupt);
    }
    return corrupt;
  }

  private index(plate: Plate, corrupt: string[]): void {
    const codes = [plate.code, ...plate.previousCodes];
    const clash = codes.find((code) => this.byCode.has(code));
    if (clash) {
      // Não deveria acontecer (códigos são únicos); se ocorrer, mantém a placa já indexada.
      corrupt.push(`data/plates/${plate.id}.enc (código "${clash}" duplicado)`);
      return;
    }
    this.byId.set(plate.id, plate);
    for (const code of codes) this.byCode.set(code, plate);
    this.maxSequence = Math.max(this.maxSequence, plate.sequence);
  }

  get(id: string): Plate | undefined {
    return this.byId.get(id);
  }

  /** Busca pelo código atual ou por um código anterior da placa. */
  getByCode(code: string): Plate | undefined {
    return this.byCode.get(code);
  }

  /**
   * Código atual de alguma placa (inclusive arquivada). Códigos anteriores não contam:
   * ficam livres para outra placa, que passa a recebê-los.
   */
  isCodeTaken(code: string): boolean {
    return this.byCode.get(code)?.code === code;
  }

  /** Próximo número sequencial cujo código ainda está livre (pula números usados manualmente). */
  nextSequence(): number {
    let next = this.maxSequence + 1;
    while (this.byCode.has(String(next))) next += 1;
    return next;
  }

  list(): Plate[] {
    return [...this.byId.values()];
  }

  async save(plate: Plate): Promise<void> {
    const previous = this.byId.get(plate.id);
    if (previous && !plate.previousCodes.includes(previous.code) && previous.code !== plate.code) {
      throw new Error("Ao trocar o código, o anterior deve ser preservado.");
    }
    await this.store.write("plates", plate.id, plate);
    this.byId.set(plate.id, plate);
    // Remove do índice códigos que esta placa deixou de ter (ex.: código antigo liberado para outra placa).
    if (previous) {
      for (const code of [previous.code, ...previous.previousCodes]) {
        if (this.byCode.get(code)?.id === plate.id) this.byCode.delete(code);
      }
    }
    for (const code of [plate.code, ...plate.previousCodes]) this.byCode.set(code, plate);
    this.maxSequence = Math.max(this.maxSequence, plate.sequence);
  }
}

// ---------- Formato antigo ----------

type LegacyPlate = Omit<Plate, "sequence" | "code" | "previousCodes" | "routing" | "schedules"> & {
  publicCode: string;
  routing: { active: boolean; qr: Target; nfc: Target; page: PlateRouting["page"] };
  schedules: Array<Schedule & { channel?: string }>;
};

function isLegacy(record: Plate | LegacyPlate): record is LegacyPlate {
  return !("code" in record) && "publicCode" in record;
}

function migrateLegacyPlate(old: LegacyPlate, sequence: number): Plate {
  const { publicCode, routing, schedules, ...rest } = old;
  return {
    ...rest,
    sequence,
    code: String(sequence),
    previousCodes: [publicCode.toLowerCase()],
    routing: { active: routing.active, target: old.type === "NFC" ? routing.nfc : routing.qr, page: routing.page },
    schedules: schedules.map((schedule) => {
      const copy = { ...schedule };
      delete copy.channel;
      return copy;
    }),
    history: [
      ...old.history,
      {
        at: new Date().toISOString(),
        action: "migrated",
        field: "code",
        before: publicCode.toLowerCase(),
        after: String(sequence),
      },
    ],
  };
}
