export const PLATE_CODE_MAX_LENGTH = 32;

/** Letras minúsculas, números, "-" e "_"; começa com letra ou número. */
const PLATE_CODE_RE = new RegExp(`^[a-z0-9][a-z0-9_-]{0,${PLATE_CODE_MAX_LENGTH - 1}}$`);

/**
 * Normaliza um código de placa (trim + minúsculas) e valida o formato.
 * Retorna `null` se inválido. Usado tanto na URL pública quanto na edição do código.
 */
export function normalizePlateCode(input: string): string | null {
  const code = input.trim().toLowerCase();
  return PLATE_CODE_RE.test(code) ? code : null;
}

export const PLATE_CODE_RULE = `Use de 1 a ${PLATE_CODE_MAX_LENGTH} caracteres: letras, números, "-" ou "_".`;
