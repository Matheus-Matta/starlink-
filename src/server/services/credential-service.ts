import "server-only";

import type { Mutex } from "@/server/concurrency";
import { AppError, notFound } from "@/server/errors";
import type { ClientRepository } from "@/server/repositories/client-repository";
import type { CredentialRepository } from "@/server/repositories/credential-repository";
import { hashPassword } from "@/server/security/password";
import type { SessionStore } from "@/server/security/sessions";
import type { ClientCredential } from "@/types/domain";

export type CredentialStatus = { enabled: boolean; hasPassword: boolean; updatedAt: string | null };

export class CredentialService {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly clients: ClientRepository,
    private readonly sessions: SessionStore,
    private readonly mutex: Mutex,
    private readonly now: () => Date = () => new Date(),
  ) {}

  status(clientId: string): CredentialStatus {
    const credential = this.credentials.get(clientId);
    return { enabled: credential?.enabled ?? false, hasPassword: Boolean(credential), updatedAt: credential?.updatedAt ?? null };
  }

  isEnabled(clientId: string): boolean {
    return this.credentials.get(clientId)?.enabled === true;
  }

  configure(clientId: string, input: { enabled: boolean; password?: string }): Promise<CredentialStatus> {
    return this.mutex.run(async () => {
      const client = this.clients.get(clientId);
      if (!client) throw notFound("Cliente");
      if (client.status !== "active" || client.anonymized) throw new AppError("CONFLICT", "Somente clientes ativos podem acessar o portal.");
      if (input.enabled && !client.email) {
        throw new AppError("VALIDATION", "Cadastre um e-mail antes de ativar o portal.", { email: "E-mail obrigatório para o acesso." });
      }
      const current = this.credentials.get(clientId);
      if (!input.enabled && !current && !input.password) {
        this.sessions.destroyClient(clientId);
        return this.status(clientId);
      }
      if (input.enabled && !current && !input.password) {
        throw new AppError("VALIDATION", "Defina a senha inicial do cliente.", { password: "Informe uma senha com pelo menos 12 caracteres." });
      }
      const duplicate = input.enabled
        ? this.credentials.list().find((item) => {
            if (!item.enabled || item.clientId === clientId) return false;
            return this.clients.get(item.clientId)?.email === client.email;
          })
        : undefined;
      if (duplicate) throw new AppError("VALIDATION", "Este e-mail já é usado por outro acesso ao portal.", { email: "E-mail já utilizado." });

      const at = this.now().toISOString();
      const credential: ClientCredential = {
        clientId,
        passwordHash: input.password ? await hashPassword(input.password) : current!.passwordHash,
        enabled: input.enabled,
        createdAt: current?.createdAt ?? at,
        updatedAt: at,
      };
      await this.credentials.save(credential);
      this.sessions.destroyClient(clientId);
      return this.status(clientId);
    });
  }

  async remove(clientId: string): Promise<void> {
    await this.credentials.remove(clientId);
    this.sessions.destroyClient(clientId);
  }
}
