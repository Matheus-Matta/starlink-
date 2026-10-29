import "server-only";

import { randomUUID } from "node:crypto";

import { onlyDigits } from "@/lib/document";
import { compareText, matchesQuery } from "@/lib/text";
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/validation";
import type { Client, RecordStatus } from "@/types/domain";
import type { Mutex } from "@/server/concurrency";
import { AppError, notFound, staleVersion } from "@/server/errors";
import type { ClientRepository } from "@/server/repositories/client-repository";
import type { CredentialRepository } from "@/server/repositories/credential-repository";
import type { PlateRepository } from "@/server/repositories/plate-repository";
import type { SessionStore } from "@/server/security/sessions";

export type ClientListFilters = { q?: string; includeArchived?: boolean };

export type ClientSummary = Client & { plateCount: number };

export class ClientService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly plates: PlateRepository,
    private readonly credentials: CredentialRepository,
    private readonly sessions: SessionStore,
    private readonly mutex: Mutex,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filters: ClientListFilters = {}): ClientSummary[] {
    const plateCounts = new Map<string, number>();
    for (const plate of this.plates.list()) {
      if (plate.status === "active" && plate.clientId) plateCounts.set(plate.clientId, (plateCounts.get(plate.clientId) ?? 0) + 1);
    }
    const q = filters.q?.trim() ?? "";
    const qDigits = onlyDigits(q);
    return this.clients
      .list()
      .filter((c) => filters.includeArchived || c.status === "active")
      .filter(
        (c) =>
          matchesQuery(q, [c.name, c.tradeName, c.email, c.contactName, c.phone]) ||
          (qDigits.length >= 3 && c.document !== null && c.document.includes(qDigits)),
      )
      .map((c) => ({ ...c, plateCount: plateCounts.get(c.id) ?? 0 }))
      .sort((a, b) => compareText(a.name, b.name));
  }

  get(id: string): Client {
    const client = this.clients.get(id);
    if (!client) throw notFound("Cliente");
    return client;
  }

  private assertUniqueDocument(document: string | null, exceptId?: string): void {
    if (!document) return;
    const duplicate = this.clients.list().find((c) => c.document === document && c.id !== exceptId);
    if (duplicate) throw new AppError("VALIDATION", "Já existe um cliente com este CPF/CNPJ.", { document: "CPF/CNPJ já cadastrado." });
  }

  private assertUniqueEmail(email: string | null, exceptId?: string): void {
    if (!email) return;
    const duplicate = this.clients.list().find((c) => c.email === email && c.id !== exceptId);
    if (duplicate) throw new AppError("VALIDATION", "Já existe um cliente com este e-mail.", { email: "E-mail já cadastrado." });
  }

  create(input: ClientCreateInput): Promise<Client> {
    return this.mutex.run(async () => {
      this.assertUniqueDocument(input.document);
      this.assertUniqueEmail(input.email);
      const at = this.now().toISOString();
      const client: Client = {
        id: randomUUID(),
        version: 1,
        ...input,
        status: "active",
        anonymized: false,
        createdAt: at,
        updatedAt: at,
      };
      await this.clients.save(client);
      return client;
    });
  }

  update(id: string, input: ClientUpdateInput): Promise<Client> {
    return this.mutex.run(async () => {
      const current = this.get(id);
      const { version, ...fields } = input;
      if (current.version !== version) throw staleVersion();
      if (current.anonymized) throw new AppError("CONFLICT", "Clientes anonimizados não podem ser editados.");
      this.assertUniqueDocument(fields.document, id);
      this.assertUniqueEmail(fields.email, id);
      const next: Client = { ...current, ...fields, version: current.version + 1, updatedAt: this.now().toISOString() };
      await this.clients.save(next);
      return next;
    });
  }

  setStatus(id: string, status: RecordStatus, version: number): Promise<Client> {
    return this.mutex.run(async () => {
      const current = this.get(id);
      if (current.version !== version) throw staleVersion();
      if (current.status === status) return current;
      if (status === "active" && current.anonymized) throw new AppError("CONFLICT", "Clientes anonimizados não podem ser reativados.");
      const next: Client = { ...current, status, version: current.version + 1, updatedAt: this.now().toISOString() };
      await this.clients.save(next);
      if (status === "archived") this.sessions.destroyClient(id);
      return next;
    });
  }

  /**
   * LGPD: apaga os dados pessoais de um cliente arquivado, preservando o registro
   * (e o vínculo com as placas/histórico) sob um nome genérico.
   */
  anonymize(id: string, version: number): Promise<Client> {
    return this.mutex.run(async () => {
      const current = this.get(id);
      if (current.version !== version) throw staleVersion();
      if (current.status !== "archived") throw new AppError("CONFLICT", "Arquive o cliente antes de anonimizá-lo.");
      if (current.anonymized) return current;
      const next: Client = {
        ...current,
        name: `Cliente anonimizado ${current.id.slice(0, 8)}`,
        tradeName: null,
        document: null,
        phone: null,
        email: null,
        contactName: null,
        notes: null,
        anonymized: true,
        version: current.version + 1,
        updatedAt: this.now().toISOString(),
      };
      await this.credentials.remove(id);
      this.sessions.destroyClient(id);
      await this.clients.save(next);
      return next;
    });
  }
}
