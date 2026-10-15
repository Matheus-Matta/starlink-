import "server-only";

import Papa from "papaparse";

import { onlyDigits } from "@/lib/document";
import { plateCreateSchema, type PlateCreateInput } from "@/lib/validation";
import type { Plate } from "@/types/domain";
import { AppError } from "@/server/errors";
import type { ClientRepository } from "@/server/repositories/client-repository";
import type { PlateService } from "@/server/services/plate-service";

export const MAX_IMPORT_BYTES = 512 * 1024;
export const MAX_IMPORT_ROWS = 1000;

export const IMPORT_COLUMNS = ["cliente", "nome", "tipo", "numero_serie", "url_destino"] as const;

export type ImportRowResult = {
  /** Número da linha no arquivo (o cabeçalho é a linha 1). */
  line: number;
  name: string;
  clientName: string | null;
  type: string;
  errors: string[];
};

export type ImportPreview = {
  rows: ImportRowResult[];
  validCount: number;
  errorCount: number;
  /** Erros que impedem a leitura do arquivo como um todo. */
  fileErrors: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Importação de placas por CSV. Fluxo em duas etapas: `preview` valida tudo sem gravar;
 * `commit` revalida e só grava se TODAS as linhas forem válidas (tudo ou nada na validação).
 */
export class ImportService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly plateService: PlateService,
  ) {}

  private parse(csv: string): { preview: ImportPreview; inputs: PlateCreateInput[] } {
    const fileErrors: string[] = [];
    if (Buffer.byteLength(csv, "utf8") > MAX_IMPORT_BYTES) {
      throw new AppError("PAYLOAD_TOO_LARGE", `O arquivo excede ${MAX_IMPORT_BYTES / 1024} KB.`);
    }
    const text = csv.replace(/^﻿/, "");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      delimitersToGuess: [",", ";", "\t"],
    });

    const headers = parsed.meta.fields ?? [];
    const missing = IMPORT_COLUMNS.filter((c) => c !== "numero_serie" && c !== "url_destino" && !headers.includes(c));
    if (missing.length) fileErrors.push(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);
    if (parsed.data.length === 0) fileErrors.push("O arquivo não contém linhas de dados.");
    if (parsed.data.length > MAX_IMPORT_ROWS) fileErrors.push(`Máximo de ${MAX_IMPORT_ROWS} linhas por importação.`);
    if (fileErrors.length) return { preview: { rows: [], validCount: 0, errorCount: 0, fileErrors }, inputs: [] };

    const rowErrors = new Map<number, string[]>();
    for (const error of parsed.errors) {
      if (typeof error.row === "number") rowErrors.set(error.row, [...(rowErrors.get(error.row) ?? []), "Linha malformada no CSV."]);
    }

    const rows: ImportRowResult[] = [];
    const inputs: PlateCreateInput[] = [];
    parsed.data.forEach((raw, index) => {
      const errors = [...(rowErrors.get(index) ?? [])];
      const clientRef = (raw.cliente ?? "").trim();
      const client = this.findClient(clientRef);
      if (!clientRef) errors.push("Cliente não informado.");
      else if (!client) errors.push("Cliente não encontrado (use o ID ou o CPF/CNPJ).");
      else if (client.status !== "active") errors.push("Cliente arquivado.");

      const candidate = {
        clientId: client?.id ?? "",
        name: raw.nome ?? "",
        serialNumber: raw.numero_serie ?? null,
        type: (raw.tipo ?? "").trim().toUpperCase().replace("+", "_"),
        destinationUrl: raw.url_destino?.trim() ? raw.url_destino : null,
      };
      const result = plateCreateSchema.safeParse(candidate);
      if (!result.success) {
        for (const issue of result.error.issues) {
          if (issue.path[0] === "clientId") continue; // já reportado acima
          errors.push(`${columnLabel(String(issue.path[0]))}: ${issue.message}`);
        }
      } else if (errors.length === 0) {
        inputs.push(result.data);
      }

      rows.push({ line: index + 2, name: candidate.name.trim(), clientName: client?.name ?? null, type: candidate.type, errors });
    });

    const errorCount = rows.filter((r) => r.errors.length > 0).length;
    return { preview: { rows, validCount: rows.length - errorCount, errorCount, fileErrors }, inputs };
  }

  private findClient(ref: string) {
    if (!ref) return undefined;
    if (UUID_RE.test(ref)) return this.clients.get(ref.toLowerCase());
    const digits = onlyDigits(ref);
    if (digits.length !== 11 && digits.length !== 14) return undefined;
    return this.clients.list().find((c) => c.document === digits);
  }

  preview(csv: string): ImportPreview {
    return this.parse(csv).preview;
  }

  async commit(csv: string): Promise<{ preview: ImportPreview; created: Plate[] }> {
    const { preview, inputs } = this.parse(csv);
    if (preview.fileErrors.length || preview.errorCount > 0) {
      throw new AppError("VALIDATION", "Corrija os erros do arquivo antes de importar.");
    }
    const created = await this.plateService.createMany(inputs);
    return { preview, created };
  }
}

function columnLabel(field: string): string {
  const labels: Record<string, string> = { name: "nome", type: "tipo", serialNumber: "numero_serie", destinationUrl: "url_destino" };
  return labels[field] ?? field;
}
