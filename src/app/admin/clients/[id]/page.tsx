import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, PlusIcon, UserXIcon } from "lucide-react";

import { ClientForm } from "@/components/admin/client-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { CopyButton } from "@/components/admin/copy-button";
import { DetailRow, EmptyState, PageHeader, Section, StatusBadge } from "@/components/admin/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLATE_TYPE_LABEL } from "@/lib/targets";
import { formatDateTime } from "@/lib/timezone";
import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";

export const metadata = { title: "Cliente" };

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  const parsed = idSchema.safeParse((await params).id);
  const app = await getApp();
  const client = parsed.success ? app.clientRepository.get(parsed.data) : undefined;
  if (!client) notFound();

  const plates = app.plates.list({ clientId: client.id, includeArchived: true });
  const tz = app.config.timeZone;
  const archived = client.status === "archived";

  return (
    <>
      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={client.status} />
            {client.anonymized && <Badge variant="outline">Anonimizado</Badge>}
            Cadastrado em {formatDateTime(client.createdAt, tz)}
          </span>
        }
        actions={
          <>
            {!archived && (
              <Button asChild size="sm">
                <Link href={`/admin/plates/new?clientId=${client.id}`}>
                  <PlusIcon />
                  Nova placa
                </Link>
              </Button>
            )}
            {archived && !client.anonymized && (
              <ConfirmAction
                label="Reativar"
                icon={<ArchiveRestoreIcon />}
                title="Reativar cliente?"
                description="O cliente volta a aparecer nas listagens e pode receber novas placas."
                confirmLabel="Reativar"
                url={`/api/admin/clients/${client.id}/status`}
                body={{ status: "active", version: client.version }}
              />
            )}
            {!archived && (
              <ConfirmAction
                label="Arquivar"
                icon={<ArchiveIcon />}
                title="Arquivar cliente?"
                description="O cliente sai das listagens. As placas continuam funcionando e o histórico é preservado. É possível reativar depois."
                confirmLabel="Arquivar"
                url={`/api/admin/clients/${client.id}/status`}
                body={{ status: "archived", version: client.version }}
              />
            )}
            {archived && !client.anonymized && (
              <ConfirmAction
                label="Anonimizar (LGPD)"
                icon={<UserXIcon />}
                variant="destructive"
                destructive
                title="Anonimizar dados pessoais?"
                description="Nome, documento, telefone, e-mail, responsável e observações serão apagados de forma irreversível. As placas e o histórico de links são mantidos. Backups antigos ainda conterão os dados até expirarem."
                confirmLabel="Anonimizar definitivamente"
                url={`/api/admin/clients/${client.id}/anonymize`}
                body={{ version: client.version }}
              />
            )}
          </>
        }
      />

      <div className="grid gap-6">
        {client.anonymized || archived ? (
          <Section title="Dados cadastrais" description={archived && !client.anonymized ? "Reative o cliente para editar." : undefined}>
            <dl className="divide-y">
              <DetailRow label="ID">{client.id}</DetailRow>
              <DetailRow label="Nome fantasia">{client.tradeName}</DetailRow>
              <DetailRow label="E-mail">{client.email}</DetailRow>
              <DetailRow label="Telefone">{client.phone}</DetailRow>
              <DetailRow label="Responsável">{client.contactName}</DetailRow>
              <DetailRow label="Endereço">{client.address}</DetailRow></dl>
          </Section>
        ) : (
          <Section
            title="Dados cadastrais"
            description={
              <span className="flex flex-wrap items-center gap-2">
                ID para importação CSV: <code className="text-xs">{client.id}</code>
                <CopyButton value={client.id} label="Copiar ID" />
              </span>
            }
          >
            <ClientForm key={client.version} client={client} />
          </Section>
        )}

        <Section title="Placas" description={`${plates.length} placa(s) vinculada(s).`}>
          {plates.length === 0 ? (
            <EmptyState>Nenhuma placa para este cliente.</EmptyState>
          ) : (
            <ul className="divide-y">
              {plates.map((plate) => (
                <li key={plate.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/plates/${plate.id}`} className="font-medium hover:underline">
                    {plate.name}
                  </Link>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{PLATE_TYPE_LABEL[plate.type]}</Badge>
                    <StatusBadge status={plate.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
