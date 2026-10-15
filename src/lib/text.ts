/** Normaliza texto para busca: minúsculas e sem acentos. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return fields.some((field) => field && normalizeForSearch(field).includes(q));
}

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}
