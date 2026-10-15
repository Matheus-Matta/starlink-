import { ImportForm } from "@/components/admin/import-form";
import { PageHeader, Section } from "@/components/admin/ui-bits";

export const metadata = { title: "Importar placas" };

const EXAMPLE = `cliente,nome,tipo,numero_serie,url_destino
12.345.678/0001-95,Balcão Centro,QR_NFC,SN-0001,https://instagram.com/minhaloja
3f2b8c4e-1a2b-4c3d-9e8f-0a1b2c3d4e5f,Mesa 2,QR,,https://g.page/r/minhaloja/review`;

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Importar placas (CSV)" description="Valida todas as linhas antes de gravar. Nada é importado se houver erros." />
      <div className="grid gap-6">
        <Section title="Formato">
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            <li>
              <strong className="text-foreground">cliente</strong> (obrigatório): ID do cliente ou CPF/CNPJ cadastrado.
            </li>
            <li>
              <strong className="text-foreground">nome</strong> (obrigatório): nome da placa.
            </li>
            <li>
              <strong className="text-foreground">tipo</strong> (obrigatório): QR, NFC ou QR_NFC.
            </li>
            <li>
              <strong className="text-foreground">numero_serie</strong> e <strong className="text-foreground">url_destino</strong> (opcionais).
            </li>
            <li>Separador vírgula, ponto e vírgula ou tab; codificação UTF-8; primeira linha com os nomes das colunas.</li>
          </ul>
          <pre className="bg-muted mt-4 overflow-x-auto rounded-md p-3 text-xs">{EXAMPLE}</pre>
        </Section>
        <Section title="Arquivo">
          <ImportForm />
        </Section>
      </div>
    </>
  );
}
