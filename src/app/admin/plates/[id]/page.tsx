import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";

import { ConfirmAction } from "@/components/admin/confirm-action";
import { CopyButton } from "@/components/admin/copy-button";
import { PlateForm } from "@/components/admin/plate-form";
import { RoutingEditor } from "@/components/admin/routing-editor";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { PageHeader, Section, StatusBadge } from "@/components/admin/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATE_TYPE_LABEL, publicPath } from "@/lib/targets";
import { formatDateTime } from "@/lib/timezone";
import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";
import { effectiveTarget, resolveAccess } from "@/server/redirects/resolve";
import { publicUrl } from "@/server/services/qr-service";

export const metadata = { title: "Placa" };

const UNAVAILABLE_REASON = {
  archived: "Placa arquivada",
  inactive: "Link desativado",
  "no-target": "Sem destino configurado",
} as const;

const HISTORY_ACTION: Record<string, string> = {
  created: "Criação",
  updated: "Dados alterados",
  archived: "Arquivada",
  restored: "Reativada",
  "link-changed": "Link alterado",
  "schedule-added": "Agendamento criado",
  "schedule-removed": "Agendamento removido",
  migrated: "Migrada para link numérico",
};

const HISTORY_FIELD: Record<string, string> = {
  plate: "Placa",
  name: "Nome",
  serialNumber: "Série",
  type: "Tipo",
  clientId: "Cliente",
  status: "Status",
  active: "Ativação",
  code: "Código do link",
  target: "Destino",
  schedule: "Agendamento",
  qr: "QR Code",
  nfc: "NFC",
  both: "QR + NFC",
  page: "Página de links",
};

export default async function PlatePage({ params }: PageProps<"/admin/plates/[id]">) {
  const parsed = idSchema.safeParse((await params).id);
  const app = await getApp();
  const plate = parsed.success ? app.plateRepository.get(parsed.data) : undefined;
  if (!plate) notFound();

  const tz = app.config.timeZone;
  const now = new Date();
  const client = app.clientRepository.get(plate.clientId);
  const clients = app.clients.list().map((c) => ({ id: c.id, name: c.name }));
  if (client && !clients.some((c) => c.id === client.id)) clients.push({ id: client.id, name: `${client.name} (arquivado)` });
  const archived = plate.status === "archived";
  const { schedule } = effectiveTarget(plate, now);
  const winningIds = schedule ? [schedule.id] : [];
  const resolution = resolveAccess(plate, now);
  const url = publicUrl(app.config.publicBaseUrl, plate);
  const qrSrc = `/api/admin/plates/${plate.id}/qr?v=${encodeURIComponent(plate.code)}`;

  return (
    <>
      <PageHeader
        title={plate.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={plate.status} />
            <Badge variant="outline">{PLATE_TYPE_LABEL[plate.type]}</Badge>
            Cliente:{" "}
            {client ? (
              <Link href={`/admin/clients/${client.id}`} className="underline">
                {client.name}
              </Link>
            ) : (
              "—"
            )}
          </span>
        }
        actions={
          archived ? (
            <ConfirmAction
              label="Reativar"
              icon={<ArchiveRestoreIcon />}
              title="Reativar placa?"
              description="O link volta a funcionar com a configuração atual."
              confirmLabel="Reativar"
              url={`/api/admin/plates/${plate.id}/status`}
              body={{ status: "active", version: plate.version }}
            />
          ) : (
            <ConfirmAction
              label="Arquivar"
              icon={<ArchiveIcon />}
              title="Arquivar placa?"
              description="O link passa a responder “Link desativado”. O código nunca será usado por outra placa e o histórico é mantido."
              confirmLabel="Arquivar"
              url={`/api/admin/plates/${plate.id}/status`}
              body={{ status: "archived", version: plate.version }}
            />
          )
        }
      />

      <Section title="Link da placa" description="O mesmo link vai no QR Code e na tag NFC. Grave/imprima uma única vez: o destino muda aqui.">
        <div className="flex items-center gap-2">
          <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-sm">{url}</code>
          <CopyButton value={url} label="Copiar link" />
        </div>
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Destino agora: </span>
          {resolution.outcome === "unavailable" ? (
            <span className="text-destructive">{UNAVAILABLE_REASON[resolution.reason]}</span>
          ) : (
            <span className="break-all">{resolution.outcome === "page" ? "Página de múltiplos links" : resolution.url}</span>
          )}
          {schedule && resolution.outcome !== "unavailable" && <span className="text-muted-foreground"> (por agendamento)</span>}
        </p>
        {plate.previousCodes.length > 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            Links anteriores (continuam funcionando):{" "}
            {plate.previousCodes.map((code) => (
              <code key={code} className="mr-2 text-xs">
                {publicPath(code)}
              </code>
            ))}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="font-medium">QR Code</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem autenticada gerada sob demanda */}
              <img src={`${qrSrc}&format=svg`} alt={`QR Code de ${plate.name}`} width={160} height={160} className="rounded-md border bg-white p-1" />
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`${qrSrc}&format=svg&download=1`}>
                    <DownloadIcon />
                    Baixar SVG
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`${qrSrc}&format=png&download=1`}>
                    <DownloadIcon />
                    Baixar PNG
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">Gravação da tag NFC</p>
            <p>1. Em um app de gravação NFC (ex.: NFC Tools), crie um registro NDEF do tipo URL/URI.</p>
            <p>2. Cole o link acima e grave na tag (NTAG213 ou superior).</p>
            <p>3. Opcional: bloqueie a tag contra regravação. O destino continua editável aqui, pois a tag guarda só o link fixo.</p>
          </div>
        </div>
        {resolution.outcome !== "unavailable" && (
          <Button asChild variant="link" size="sm" className="mt-4 px-0">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              Testar link (conta um acesso)
            </a>
          </Button>
        )}
      </Section>

      <Tabs defaultValue="links" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="links">Destino</TabsTrigger>
          <TabsTrigger value="schedules">Agendamentos ({plate.schedules.length})</TabsTrigger>
          <TabsTrigger value="details">Dados e código</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="links">
          <Section title="Destino do link" description="Mudanças valem imediatamente; o link da placa não muda.">
            {archived ? (
              <p className="text-muted-foreground text-sm">Reative a placa para editar o destino.</p>
            ) : (
              <RoutingEditor key={plate.version} plate={plate} />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="schedules">
          <Section title="Agendamentos de destino">
            {archived ? (
              <p className="text-muted-foreground text-sm">Reative a placa para gerenciar agendamentos.</p>
            ) : (
              <ScheduleManager key={plate.version} plate={plate} defaultTimeZone={tz} nowIso={now.toISOString()} winningIds={winningIds} />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="details">
          <Section
            title="Dados da placa"
            description={
              <>
                Placa nº {plate.sequence} · criada em {formatDateTime(plate.createdAt, tz)}
              </>
            }
          >
            {archived ? (
              <p className="text-muted-foreground text-sm">Reative a placa para editar.</p>
            ) : (
              <PlateForm key={plate.version} plate={plate} clients={clients} />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="history">
          <Section title="Histórico de alterações" description={`Últimas ${plate.history.length} alterações (mais recentes primeiro).`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Depois</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...plate.history].reverse().map((entry, index) => (
                    <TableRow key={`${entry.at}-${index}`}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(entry.at, tz)}</TableCell>
                      <TableCell>{HISTORY_ACTION[entry.action] ?? entry.action}</TableCell>
                      <TableCell>{HISTORY_FIELD[entry.field] ?? entry.field}</TableCell>
                      <TableCell className="max-w-xs text-xs break-all whitespace-pre-line">{formatHistoryValue(entry.field, entry.before, clients)}</TableCell>
                      <TableCell className="max-w-xs text-xs break-all whitespace-pre-line">{formatHistoryValue(entry.field, entry.after, clients)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function formatHistoryValue(field: string, value: string | null, clients: Array<{ id: string; name: string }>): string {
  if (value === null) return "—";
  if (field === "clientId") return clients.find((c) => c.id === value)?.name ?? value;
  if (field === "status") return value === "active" ? "Ativa" : "Arquivada";
  if (field === "type") return PLATE_TYPE_LABEL[value as keyof typeof PLATE_TYPE_LABEL] ?? value;
  return value;
}
