import type { PlateType, Target } from "@/types/domain";

export const MAX_PAGE_BUTTONS = 12;

export const PLATE_TYPE_LABEL: Record<PlateType, string> = { QR: "QR Code", NFC: "NFC", QR_NFC: "QR Code + NFC" };

/** Caminho público da placa: o mesmo para o QR Code e para a tag NFC. */
export function publicPath(code: string): string {
  return `/r/${code}`;
}

export function describeTarget(target: Target): string {
  if (target.kind === "url") return target.url;
  if (target.kind === "page") return "Página de múltiplos links";
  return "Sem destino";
}
