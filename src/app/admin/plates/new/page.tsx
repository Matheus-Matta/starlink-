import { PlateForm } from "@/components/admin/plate-form";
import { PageHeader, Section } from "@/components/admin/ui-bits";
import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";

export const metadata = { title: "Nova placa" };

export default async function NewPlatePage({ searchParams }: PageProps<"/admin/plates/new">) {
  const app = await getApp();
  const clients = app.clients.list().map((c) => ({ id: c.id, name: c.name }));
  const defaultClientId = idSchema.safeParse((await searchParams).clientId).data;

  return (
    <>
      <PageHeader title="Nova placa" description="Defina o código do link (/r/…) ou deixe o número automático (1, 2, 3…)." />
      <Section title="Dados da placa">
        <PlateForm clients={clients} defaultClientId={defaultClientId} nextCode={String(app.plateRepository.nextSequence())} />
      </Section>
    </>
  );
}
