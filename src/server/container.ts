import "server-only";

import { getConfig, type AppConfig } from "@/server/config";
import { Mutex } from "@/server/concurrency";
import { errorSummary, log } from "@/server/logger";
import { ClientRepository } from "@/server/repositories/client-repository";
import { FileStore } from "@/server/repositories/file-store";
import { PlateRepository } from "@/server/repositories/plate-repository";
import { StatsRepository } from "@/server/repositories/stats-repository";
import { AuthService } from "@/server/security/auth";
import { RateLimiter } from "@/server/security/rate-limit";
import { SessionStore } from "@/server/security/sessions";
import { ClientService } from "@/server/services/client-service";
import { ImportService } from "@/server/services/import-service";
import { PlateService } from "@/server/services/plate-service";
import { StatsService } from "@/server/services/stats-service";

export type App = {
  config: AppConfig;
  clients: ClientService;
  plates: PlateService;
  imports: ImportService;
  stats: StatsService;
  auth: AuthService;
  sessions: SessionStore;
  /** Limita varreduras nas URLs públicas (por IP). */
  publicLimiter: RateLimiter;
  plateRepository: PlateRepository;
  clientRepository: ClientRepository;
  health: { startedAt: string; corruptFiles: string[] };
};

/** Monta a aplicação a partir de um diretório e chave (também usado nos testes de integração). */
export async function createApp(config: AppConfig): Promise<App> {
  const store = new FileStore(config.storageDir, config.dataKey);
  await store.init();

  const clientRepository = new ClientRepository(store);
  const plateRepository = new PlateRepository(store);
  const statsRepository = new StatsRepository(store);
  const corruptFiles = [...(await clientRepository.load()), ...(await plateRepository.load()), ...(await statsRepository.load())];
  for (const file of corruptFiles) log("error", "storage.corrupt_file", { file });

  // Uma única fila de mutações para clientes e placas (ambos se referenciam).
  const mutex = new Mutex();
  const plates = new PlateService(plateRepository, clientRepository, mutex);
  const sessions = new SessionStore(config.sessionSecret, config.sessionTtlMs, config.sessionIdleMs);

  return {
    config,
    clients: new ClientService(clientRepository, plateRepository, mutex),
    plates,
    imports: new ImportService(clientRepository, plates),
    stats: new StatsService(statsRepository, config.timeZone, config.statsFlushMs),
    auth: new AuthService(config, sessions),
    sessions,
    publicLimiter: new RateLimiter({ limit: 120, windowMs: 60_000, blockMs: 60_000, maxBlockMs: 15 * 60_000, maxKeys: 50_000 }),
    plateRepository,
    clientRepository,
    health: { startedAt: new Date().toISOString(), corruptFiles },
  };
}

// Guardado em globalThis para sobreviver ao HMR do `next dev` e ser único por processo.
const globalForApp = globalThis as typeof globalThis & { __starlinkApp?: Promise<App> };

export function getApp(): Promise<App> {
  globalForApp.__starlinkApp ??= createApp(getConfig()).then(
    (app) => {
      app.stats.start();
      registerShutdown(app);
      log("info", "app.started", { records: app.plateRepository.list().length, corrupt: app.health.corruptFiles.length });
      return app;
    },
    (error: unknown) => {
      // Permite nova tentativa (ex.: depois de corrigir o .env) em vez de manter a falha em cache.
      globalForApp.__starlinkApp = undefined;
      throw error;
    },
  );
  return globalForApp.__starlinkApp;
}

function registerShutdown(app: App): void {
  const flush = (signal: string) => {
    app.stats.stop();
    app.stats
      .flush()
      .catch((error: unknown) => log("error", "stats.final_flush_failed", errorSummary(error)))
      .finally(() => {
        log("info", "app.shutdown", { signal });
        process.exit(0);
      });
  };
  process.once("SIGTERM", () => flush("SIGTERM"));
  process.once("SIGINT", () => flush("SIGINT"));
}
