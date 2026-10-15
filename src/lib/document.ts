/** Remove a formatação de CPF/CNPJ, mantendo apenas dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatDocument(digits: string): string {
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return digits;
}

/** Mascara o documento para listagens (exibe apenas os 2 últimos dígitos). */
export function maskDocument(digits: string): string {
  return `${"•".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
}
