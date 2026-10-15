import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade | Starlink" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <div className="text-muted-foreground mt-6 space-y-4 text-sm leading-relaxed">
        <p>
          <strong className="text-foreground">Visitantes das placas.</strong> Ao acessar um QR Code ou tag NFC, registramos apenas uma
          contagem agregada por dia, placa e canal (QR ou NFC). Não armazenamos endereço IP, identificadores do aparelho, localização nem
          cookies de rastreamento. O IP é usado somente em memória, de forma transitória, para limitar abusos.
        </p>
        <p>
          <strong className="text-foreground">Clientes.</strong> Os dados cadastrais (nome, documento, contatos) são usados exclusivamente
          para a gestão das placas contratadas, armazenados com criptografia (AES-256-GCM) e acessíveis apenas ao administrador. Mediante
          solicitação, o cadastro pode ser arquivado e anonimizado. Cópias de segurança são mantidas pelo período definido pelo operador e
          também são criptografadas.
        </p>
        <p>
          <strong className="text-foreground">Destinos.</strong> Os links redirecionam para sites de terceiros, que possuem suas próprias
          políticas de privacidade.
        </p>
      </div>
    </main>
  );
}
