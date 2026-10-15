"use client";

import { useState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/admin/form-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";

type Row = { line: number; name: string; clientName: string | null; type: string; errors: string[] };
type Preview = { rows: Row[]; validCount: number; errorCount: number; fileErrors: string[] };

const MAX_FILE_BYTES = 512 * 1024;

export function ImportForm() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const { call, pending } = useApi();

  async function onFile(file: File | undefined) {
    setPreview(null);
    setMessage({});
    setCsv(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ error: "O arquivo excede 512 KB." });
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    const result = await call<{ preview: Preview }>("POST", "/api/admin/plates/import", { mode: "preview", csv: text });
    if (!result.ok) setMessage({ error: result.error.message });
    else setPreview(result.data.preview);
  }

  async function commit() {
    if (!csv) return;
    setMessage({});
    const result = await call<{ created: number }>("POST", "/api/admin/plates/import", { mode: "commit", csv });
    if (!result.ok) {
      setMessage({ error: result.error.message });
      return;
    }
    setMessage({ success: `${result.data.created} placa(s) criada(s) com sucesso.` });
    setPreview(null);
    setCsv(null);
  }

  const canCommit = preview && preview.fileErrors.length === 0 && preview.errorCount === 0 && preview.validCount > 0;

  return (
    <div className="grid gap-4">
      <FormMessage error={message.error} success={message.success} />
      {message.success && (
        <p className="text-sm">
          <Link href="/admin/plates" className="underline">
            Ver placas
          </Link>
        </p>
      )}

      <label className="grid gap-2 text-sm font-medium">
        Arquivo CSV (até 512 KB e 1000 linhas)
        <input
          type="file"
          accept=".csv,text/csv"
          className="file:bg-secondary file:text-secondary-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
          onChange={(e) => void onFile(e.target.files?.[0])}
          disabled={pending}
        />
      </label>

      {pending && <p className="text-muted-foreground text-sm">Processando…</p>}

      {preview && (
        <div className="grid gap-4">
          {preview.fileErrors.length > 0 ? (
            <FormMessage error={preview.fileErrors.join(" ")} />
          ) : (
            <p className="text-sm">
              <strong>{fileName}</strong>: {preview.validCount} linha(s) válida(s), {preview.errorCount} com erro.
              {preview.errorCount > 0 && " Corrija o arquivo e envie novamente — nada é gravado enquanto houver erros."}
            </p>
          )}

          {preview.rows.length > 0 && (
            <div className="max-h-[480px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.line}>
                      <TableCell className="tabular-nums">{row.line}</TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>{row.clientName ?? "—"}</TableCell>
                      <TableCell>{row.type || "—"}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <Badge variant="secondary">OK</Badge>
                        ) : (
                          <ul className="text-destructive list-inside list-disc text-xs">
                            {row.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Button type="button" onClick={() => void commit()} disabled={!canCommit || pending}>
              Importar {preview.validCount} placa(s)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
