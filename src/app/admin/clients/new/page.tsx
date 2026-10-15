import { ClientForm } from "@/components/admin/client-form";
import { PageHeader, Section } from "@/components/admin/ui-bits";

export const metadata = { title: "Novo cliente" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Novo cliente" />
      <Section title="Dados cadastrais">
        <ClientForm />
      </Section>
    </>
  );
}
