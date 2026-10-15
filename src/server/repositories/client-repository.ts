import "server-only";

import type { Client } from "@/types/domain";
import type { FileStore } from "@/server/repositories/file-store";

/**
 * Clientes: um arquivo criptografado por registro, com cópia em memória
 * carregada no início (a fonte de verdade é sempre o disco).
 */
export class ClientRepository {
  private readonly byId = new Map<string, Client>();

  constructor(private readonly store: FileStore) {}

  /** Carrega todos os registros; retorna os arquivos corrompidos encontrados. */
  async load(): Promise<string[]> {
    const { records, corrupt } = await this.store.readAll<Client>("clients");
    this.byId.clear();
    for (const client of records) this.byId.set(client.id, client);
    return corrupt;
  }

  get(id: string): Client | undefined {
    return this.byId.get(id);
  }

  list(): Client[] {
    return [...this.byId.values()];
  }

  async save(client: Client): Promise<void> {
    await this.store.write("clients", client.id, client);
    this.byId.set(client.id, client);
  }
}
