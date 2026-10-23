import "server-only";

import { randomUUID } from "node:crypto";

import { describeTarget } from "@/lib/targets";
import { compareText, matchesQuery } from "@/lib/text";
import { zonedLocalToUtc } from "@/lib/timezone";
import type { ClientRoutingUpdateInput, PlateCreateInput, PlateUpdateInput, RoutingUpdateInput, ScheduleCreateInput } from "@/lib/validation";
import type { HistoryEntry, Plate, PlateRouting, RecordStatus, Schedule, Target } from "@/types/domain";
import type { Mutex } from "@/server/concurrency";
import { AppError, notFound, staleVersion } from "@/server/errors";
import type { ClientRepository } from "@/server/repositories/client-repository";
import type { PlateRepository } from "@/server/repositories/plate-repository";

export const MAX_HISTORY_ENTRIES = 300;
export const MAX_SCHEDULES = 50;
/** Agendamentos encerrados há mais tempo que isso são removidos na próxima gravação. */
const EXPIRED_SCHEDULE_RETENTION_MS = 90 * 24 * 3600_000;

export type PlateListFilters = { q?: string; clientId?: string; includeArchived?: boolean };

export class PlateService {
  constructor(
    private readonly plates: PlateRepository,
    private readonly clients: ClientRepository,
    private readonly mutex: Mutex,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filters: PlateListFilters = {}): Plate[] {
    const q = filters.q?.trim() ?? "";
    return this.plates
      .list()
      .filter((p) => filters.includeArchived || p.status === "active")
      .filter((p) => !filters.clientId || p.clientId === filters.clientId)
      .filter((p) => matchesQuery(q, [p.name, p.serialNumber, p.code, ...p.previousCodes, this.clients.get(p.clientId)?.name]))
      .sort((a, b) => compareText(a.name, b.name));
  }

  get(id: string): Plate {
    const plate = this.plates.get(id);
    if (!plate) throw notFound("Placa");
    return plate;
  }

  private assertActiveClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) throw new AppError("VALIDATION", "Cliente não encontrado.", { clientId: "Cliente não encontrado." });
    if (client.status !== "active") {
      throw new AppError("VALIDATION", "O cliente está arquivado.", { clientId: "Selecione um cliente ativo." });
    }
  }

  private buildPlate(input: PlateCreateInput, at: string): Plate {
    const target: Target = input.destinationUrl ? { kind: "url", url: input.destinationUrl } : { kind: "none" };
    // Código inicial = próximo número da sequência (1, 2, 3…); pode ser alterado depois.
    const sequence = this.plates.nextSequence();
    return {
      id: randomUUID(),
      version: 1,
      sequence,
      code: String(sequence),
      previousCodes: [],
      clientId: input.clientId,
      name: input.name,
      serialNumber: input.serialNumber,
      type: input.type,
      status: "active",
      routing: { active: true, target, page: { title: input.name, description: null, buttons: [] } },
      schedules: [],
      history: [{ at, action: "created", field: "plate", before: null, after: `/r/${sequence} → ${describeTarget(target)}` }],
      createdAt: at,
      updatedAt: at,
    };
  }

  create(input: PlateCreateInput): Promise<Plate> {
    return this.mutex.run(async () => {
      this.assertActiveClient(input.clientId);
      const plate = this.buildPlate(input, this.now().toISOString());
      await this.plates.save(plate);
      return plate;
    });
  }

  /** Cria várias placas já validadas, numa única passagem pela fila de mutações. */
  createMany(inputs: PlateCreateInput[]): Promise<Plate[]> {
    return this.mutex.run(async () => {
      for (const input of inputs) this.assertActiveClient(input.clientId);
      const created: Plate[] = [];
      for (const input of inputs) {
        const plate = this.buildPlate(input, this.now().toISOString());
        await this.plates.save(plate);
        created.push(plate);
      }
      return created;
    });
  }

  /** Aplica uma alteração com verificação de versão, histórico e limpeza de agendamentos antigos. */
  private mutate(
    id: string,
    version: number,
    change: (plate: Plate, at: string) => { plate: Plate; history: HistoryEntry[] },
    authorize?: (plate: Plate) => void,
  ) {
    return this.mutex.run(async () => {
      const current = this.get(id);
      authorize?.(current);
      if (current.version !== version) throw staleVersion();
      const at = this.now().toISOString();
      const { plate, history } = change(current, at);
      const cutoff = Date.parse(at) - EXPIRED_SCHEDULE_RETENTION_MS;
      const next: Plate = {
        ...plate,
        schedules: plate.schedules.filter((s) => s.endsAt === null || Date.parse(s.endsAt) > cutoff),
        history: [...current.history, ...history].slice(-MAX_HISTORY_ENTRIES),
        version: current.version + 1,
        updatedAt: at,
      };
      await this.plates.save(next);
      return next;
    });
  }

  update(id: string, input: PlateUpdateInput): Promise<Plate> {
    const { version, ...fields } = input;
    return this.mutate(id, version, (current, at) => {
      if (fields.clientId !== current.clientId) this.assertActiveClient(fields.clientId);
      const history: HistoryEntry[] = [];
      const track = (field: string, before: string | null, after: string | null) => {
        if (before !== after) history.push({ at, action: "updated", field, before, after });
      };
      track("name", current.name, fields.name);
      track("serialNumber", current.serialNumber, fields.serialNumber);
      track("type", current.type, fields.type);
      track("clientId", current.clientId, fields.clientId);

      let previousCodes = current.previousCodes;
      if (fields.code !== current.code) {
        if (this.plates.isCodeTaken(fields.code) && !current.previousCodes.includes(fields.code)) {
          throw new AppError("VALIDATION", "Este código já está em uso.", { code: "Código já usado por outra placa (atual ou anterior)." });
        }
        // O código antigo continua redirecionando para esta placa (placas já impressas/gravadas não quebram).
        previousCodes = [...current.previousCodes.filter((c) => c !== fields.code), current.code];
        track("code", current.code, fields.code);
      }
      return { plate: { ...current, ...fields, previousCodes }, history };
    });
  }

  setStatus(id: string, status: RecordStatus, version: number): Promise<Plate> {
    return this.mutate(id, version, (current, at) => {
      if (status === "active") this.assertActiveClient(current.clientId);
      const history: HistoryEntry[] =
        current.status === status ? [] : [{ at, action: status === "archived" ? "archived" : "restored", field: "status", before: current.status, after: status }];
      return { plate: { ...current, status }, history };
    });
  }

  updateRouting(id: string, input: RoutingUpdateInput): Promise<Plate> {
    return this.mutate(id, input.version, (current, at) => {
      if (current.status === "archived") throw new AppError("CONFLICT", "Reative a placa antes de alterar seus links.");
      const routing: PlateRouting = {
        active: input.active,
        target: input.target,
        page: {
          title: input.page.title,
          description: input.page.description,
          buttons: input.page.buttons.map((b) => ({ id: b.id ?? randomUUID(), label: b.label, url: b.url, active: b.active })),
        },
      };
      const history: HistoryEntry[] = [];
      const track = (field: string, before: string, after: string) => {
        if (before !== after) history.push({ at, action: "link-changed", field, before, after });
      };
      track("active", current.routing.active ? "ativo" : "inativo", routing.active ? "ativo" : "inativo");
      track("target", describeTarget(current.routing.target), describeTarget(routing.target));
      track("page", summarizePage(current.routing.page), summarizePage(routing.page));
      return { plate: { ...current, routing }, history };
    });
  }

  /** Edição reduzida do portal, com autorização por objeto dentro da mesma seção crítica da gravação. */
  updateClientRouting(clientId: string, id: string, input: ClientRoutingUpdateInput): Promise<Plate> {
    return this.mutate(id, input.version, (current, at) => {
      if (current.status === "archived") throw new AppError("CONFLICT", "Esta placa está arquivada.");
      const target: Target = input.destinationUrl ? { kind: "url", url: input.destinationUrl } : { kind: "none" };
      const history: HistoryEntry[] = [];
      if (current.routing.active !== input.active) {
        history.push({ at, action: "client-link-changed", field: "active", before: current.routing.active ? "ativo" : "inativo", after: input.active ? "ativo" : "inativo" });
      }
      if (describeTarget(current.routing.target) !== describeTarget(target)) {
        history.push({ at, action: "client-link-changed", field: "target", before: describeTarget(current.routing.target), after: describeTarget(target) });
      }
      return { plate: { ...current, routing: { ...current.routing, active: input.active, target } }, history };
    }, (current) => {
      if (current.clientId !== clientId) throw new AppError("NOT_FOUND", "Placa não encontrada.");
    });
  }

  addSchedule(id: string, input: ScheduleCreateInput): Promise<Plate> {
    const startsAt = zonedLocalToUtc(input.startsAt, input.timeZone);
    const endsAt = input.endsAt ? zonedLocalToUtc(input.endsAt, input.timeZone) : null;
    if (!startsAt) throw new AppError("VALIDATION", "Data de início inválida.", { startsAt: "Data/hora inválida." });
    if (input.endsAt && !endsAt) throw new AppError("VALIDATION", "Data de término inválida.", { endsAt: "Data/hora inválida." });
    if (endsAt && endsAt <= startsAt) {
      throw new AppError("VALIDATION", "O término deve ser posterior ao início.", { endsAt: "Deve ser posterior ao início." });
    }

    return this.mutate(id, input.version, (current, at) => {
      if (current.status === "archived") throw new AppError("CONFLICT", "Reative a placa antes de agendar mudanças.");
      if (endsAt && endsAt.getTime() <= Date.parse(at)) {
        throw new AppError("VALIDATION", "Este agendamento já estaria expirado.", { endsAt: "O término já passou." });
      }
      if (current.schedules.length >= MAX_SCHEDULES) {
        throw new AppError("VALIDATION", `Limite de ${MAX_SCHEDULES} agendamentos por placa atingido.`);
      }
      const schedule: Schedule = {
        id: randomUUID(),
        target: input.target,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : null,
        timeZone: input.timeZone,
        note: input.note,
        createdAt: at,
      };
      const history: HistoryEntry[] = [
        { at, action: "schedule-added", field: "schedule", before: null, after: `${describeTarget(input.target)} @ ${schedule.startsAt}` },
      ];
      return { plate: { ...current, schedules: [...current.schedules, schedule] }, history };
    });
  }

  removeSchedule(id: string, scheduleId: string, version: number): Promise<Plate> {
    return this.mutate(id, version, (current, at) => {
      const schedule = current.schedules.find((s) => s.id === scheduleId);
      if (!schedule) throw notFound("Agendamento");
      const history: HistoryEntry[] = [
        { at, action: "schedule-removed", field: "schedule", before: `${describeTarget(schedule.target)} @ ${schedule.startsAt}`, after: null },
      ];
      return { plate: { ...current, schedules: current.schedules.filter((s) => s.id !== scheduleId) }, history };
    });
  }
}

function summarizePage(page: PlateRouting["page"]): string {
  const buttons = page.buttons.map((b) => `${b.active ? "" : "[inativo] "}${b.label} → ${b.url}`);
  return [page.title, page.description ?? "", ...buttons].join("\n");
}
