import { z } from "zod";

import { isValidCnpj, isValidCpf, onlyDigits } from "@/lib/document";
import { PLATE_CODE_RULE, normalizePlateCode } from "@/lib/plate-code";
import { MAX_PAGE_BUTTONS } from "@/lib/targets";
import { checkDestinationUrl } from "@/lib/url";
import { isValidTimeZone } from "@/lib/timezone";

/** Texto opcional: string vazia vira `null`; aplica trim e limite de tamanho. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `Informe ${label}.`).max(max, `Máximo de ${max} caracteres.`);

export const idSchema = z.uuid("Identificador inválido.");

const versionSchema = z.number().int().min(1);

export const destinationUrlSchema = z.string().transform((value, ctx) => {
  const result = checkDestinationUrl(value);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.reason });
    return z.NEVER;
  }
  return result.url;
});

// ---------- Autenticação ----------

export const loginSchema = z.object({
  identifier: z.string().trim().max(254).optional().default("admin"),
  password: z.string().min(1, "Informe a senha.").max(256),
});

// ---------- Clientes ----------

const documentSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const digits = onlyDigits(v);
    if (!(digits.length === 11 ? isValidCpf(digits) : digits.length === 14 ? isValidCnpj(digits) : false)) {
      ctx.addIssue({ code: "custom", message: "CPF/CNPJ inválido." });
      return z.NEVER;
    }
    return digits;
  });

const phoneSchema = optionalText(30).refine((v) => v === null || /^[0-9+()\-.\s]{8,30}$/.test(v), "Telefone inválido.");

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .nullish()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido.");

const clientFields = {
  name: requiredText(200, "o nome ou razão social"),
  tradeName: optionalText(200),
  document: documentSchema,
  phone: phoneSchema,
  email: emailSchema,
  contactName: optionalText(120),
  notes: optionalText(2000),
  address: optionalText(500),
};

export const clientCreateSchema = z.object(clientFields);
export const clientUpdateSchema = z.object(clientFields).extend({ version: versionSchema });

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export const clientAccessSchema = z.object({
  enabled: z.boolean(),
  password: z.string().min(12, "Use pelo menos 12 caracteres.").max(256).optional(),
});

// ---------- Placas ----------

export const plateTypeSchema = z.enum(["QR", "NFC", "QR_NFC"], "Tipo inválido.");

const serialSchema = optionalText(64).refine(
  (v) => v === null || /^[A-Za-z0-9._\-/]+$/.test(v),
  "Número de série aceita apenas letras, números e . _ - /",
);

/** Cliente opcional: vazio/ausente vira `null`. */
const optionalClientIdSchema = z.preprocess((v) => (v === "" || v === undefined ? null : v), idSchema.nullable());

const plateFields = {
  clientId: optionalClientIdSchema,
  name: requiredText(120, "o nome da placa"),
  serialNumber: serialSchema,
  type: plateTypeSchema,
};

/** Código da URL pública (/r/<código>): normalizado para minúsculas. */
export const plateCodeSchema = z.string().transform((value, ctx) => {
  const code = normalizePlateCode(value);
  if (!code) {
    ctx.addIssue({ code: "custom", message: PLATE_CODE_RULE });
    return z.NEVER;
  }
  return code;
});

/** Na criação o código é opcional: vazio usa o próximo número da sequência. */
export const plateCreateSchema = z.object({
  ...plateFields,
  destinationUrl: destinationUrlSchema.nullish(),
  code: z.preprocess((v) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v), plateCodeSchema.optional()),
});

export const plateUpdateSchema = z.object(plateFields).extend({ version: versionSchema, code: plateCodeSchema });

export type PlateCreateInput = z.infer<typeof plateCreateSchema>;
export type PlateUpdateInput = z.infer<typeof plateUpdateSchema>;

// ---------- Links / destinos ----------

export const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: destinationUrlSchema }),
  z.object({ kind: z.literal("page") }),
  z.object({ kind: z.literal("none") }),
]);

const pageButtonSchema = z.object({
  id: idSchema.optional(),
  label: requiredText(60, "o texto do botão"),
  url: destinationUrlSchema,
  active: z.boolean(),
});

export const routingUpdateSchema = z.object({
  version: versionSchema,
  active: z.boolean(),
  target: targetSchema,
  page: z.object({
    title: requiredText(120, "o título da página"),
    description: optionalText(500),
    buttons: z.array(pageButtonSchema).max(MAX_PAGE_BUTTONS, `Máximo de ${MAX_PAGE_BUTTONS} botões.`),
  }),
});

export type RoutingUpdateInput = z.infer<typeof routingUpdateSchema>;

export const clientRoutingUpdateSchema = z.object({
  version: versionSchema,
  active: z.boolean(),
  destinationUrl: destinationUrlSchema.nullish().transform((value) => value ?? null),
});

export type ClientRoutingUpdateInput = z.infer<typeof clientRoutingUpdateSchema>;

// ---------- Agendamentos ----------

const timeZoneSchema = z.string().refine(isValidTimeZone, "Fuso horário inválido.");
const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida.");

export const scheduleCreateSchema = z.object({
  version: versionSchema,
  target: targetSchema,
  startsAt: localDateTimeSchema,
  endsAt: localDateTimeSchema.nullish().transform((v) => v ?? null),
  timeZone: timeZoneSchema,
  note: optionalText(200),
});

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

export const versionOnlySchema = z.object({ version: versionSchema });

export const statusUpdateSchema = z.object({ version: versionSchema, status: z.enum(["active", "archived"]) });

export const importRequestSchema = z.object({ mode: z.enum(["preview", "commit"]), csv: z.string() });

export const statsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientId: idSchema.optional(),
  plateId: idSchema.optional(),
});

// ---------- Erros ----------

export type FieldErrors = Record<string, string>;

/** Converte os issues do zod em `{ "campo.sub": "mensagem" }` (primeira mensagem por campo). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
