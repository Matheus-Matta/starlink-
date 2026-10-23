import "server-only";

import type { ClientCredential } from "@/types/domain";
import type { FileStore } from "@/server/repositories/file-store";

export class CredentialRepository {
  private readonly byClientId = new Map<string, ClientCredential>();

  constructor(private readonly store: FileStore) {}

  async load(): Promise<string[]> {
    const { records, corrupt } = await this.store.readAll<ClientCredential>("credentials");
    this.byClientId.clear();
    for (const credential of records) this.byClientId.set(credential.clientId, credential);
    return corrupt;
  }

  get(clientId: string): ClientCredential | undefined {
    return this.byClientId.get(clientId);
  }

  list(): ClientCredential[] {
    return [...this.byClientId.values()];
  }

  async save(credential: ClientCredential): Promise<void> {
    await this.store.write("credentials", credential.clientId, credential);
    this.byClientId.set(credential.clientId, credential);
  }

  async remove(clientId: string): Promise<void> {
    await this.store.remove("credentials", clientId);
    this.byClientId.delete(clientId);
  }
}
