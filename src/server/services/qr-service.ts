import "server-only";

import QRCode from "qrcode";

import { publicPath } from "@/lib/targets";
import type { Plate } from "@/types/domain";

export type QrFormat = "svg" | "png";

/** URL pública da placa (a mesma impressa no QR Code e gravada na tag NFC). */
export function publicUrl(baseUrl: string, plate: Plate): string {
  return `${baseUrl}${publicPath(plate.code)}`;
}

/**
 * Gera o QR Code da URL pública. Correção de erro "Q" (~25%) tolera desgaste/sujeira
 * na placa física; margem de 4 módulos conforme a especificação.
 */
export async function renderQr(url: string, format: QrFormat): Promise<Buffer> {
  const options = { errorCorrectionLevel: "Q" as const, margin: 4 };
  if (format === "svg") return Buffer.from(await QRCode.toString(url, { ...options, type: "svg" }), "utf8");
  return QRCode.toBuffer(url, { ...options, type: "png", width: 1024 });
}
