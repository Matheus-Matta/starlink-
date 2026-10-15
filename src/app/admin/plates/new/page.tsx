import Link from "next/link";

import { PlateForm } from "@/components/admin/plate-form";
import { EmptyState, PageHeader, Section } from "@/components/admin/ui-bits";
import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";

export const metadata = { title: "Nova placa" };

export default async function NewPlatePage({ searchParams }: PageProps<"/admin/plates/new">) {
  const app = await getApp();
  const clients = app.clients.list().map((c) => ({ id: c.id, name: c.name }));
  const defaultClientId = idSchema.safeParse((await searchParams).clientId).data;

  return (
    <>
      <PageHeader title="Nova placa" description="O link recebe um número automático (1, 2, 3…), que pode ser alterado depois." />
      <Section title="Dados da placa">
        {clients.length === 0 ? (
          <EmptyState>
            Cadastre um <Link href="/admin/clients/new" className="underline">cliente</Link> antes de criar placas.
          </EmptyState>
        ) : (
          <PlateForm clients={clients} defaultClientId={defaultClientId} nextCode={String(app.plateRepository.nextSequence())} />
        )}
      </Section>
    </>
  );
}
