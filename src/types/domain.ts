// Modelos de domínio persistidos. Datas sempre em ISO 8601 (UTC).

export type RecordStatus = "active" | "archived";

export type Client = {
  id: string;
  /** Incrementado a cada gravação; usado para detectar edições concorrentes. */
  version: number;
  name: string;
  tradeName: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  notes: string | null;
  status: RecordStatus;
  anonymized: boolean;
  createdAt: string;
  updatedAt: string;
  address: string | null;
};

/** Credencial do portal, persistida separadamente dos dados retornados pelas APIs de clientes. */
export type ClientCredential = {
  clientId: string;
  passwordHash: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlateType = "QR" | "NFC" | "QR_NFC";

/** Destino de um canal: URL externa, página de múltiplos links ou nenhum. */
export type Target = { kind: "url"; url: string } | { kind: "page" } | { kind: "none" };

export type PageButton = {
  id: string;
  label: string;
  url: string;
  active: boolean;
};

export type LinkPage = {
  title: string;
  description: string | null;
  buttons: PageButton[];
};

/** Configuração do link da placa. QR Code e NFC usam a mesma URL (/r/<código>) e o mesmo destino. */
export type PlateRouting = {
  active: boolean;
  target: Target;
  page: LinkPage;
};

/**
 * Troca agendada de destino. Vale de `startsAt` (inclusive) até `endsAt` (exclusive, opcional).
 * Quando vários agendamentos valem ao mesmo tempo, vence o de `startsAt` mais recente
 * (desempate: `createdAt` mais recente e, por fim, `id`).
 */
export type Schedule = {
  id: string;
  target: Target;
  startsAt: string;
  endsAt: string | null;
  /** Fuso IANA usado na criação; apenas para exibição. */
  timeZone: string;
  note: string | null;
  createdAt: string;
};

export type HistoryEntry = {
  at: string;
  action: string;
  /** Campo alterado, ex.: "target", "page", "active", "code". */
  field: string;
  before: string | null;
  after: string | null;
};

export type Plate = {
  id: string;
  version: number;
  /** Número sequencial atribuído na criação (1, 2, 3…); nunca muda. */
  sequence: number;
  /** Código atual da URL pública (/r/<código>). Começa como o número sequencial e pode ser alterado. */
  code: string;
  /** Códigos anteriores: continuam redirecionando para esta placa e nunca são usados por outra. */
  previousCodes: string[];
  clientId: string;
  name: string;
  serialNumber: string | null;
  type: PlateType;
  status: RecordStatus;
  routing: PlateRouting;
  schedules: Schedule[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

/** Contagem agregada de acessos por dia (no fuso configurado) e placa. */
export type AccessCounts = Record<string, number>;

export type StatsMonth = {
  /** Chave: `${dia YYYY-MM-DD}|${plateId}` → total de acessos (registros antigos têm um 3º campo, ignorado). */
  counts: AccessCounts;
};
