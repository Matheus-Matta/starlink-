import { handlePublicAccess } from "@/server/redirects/public-access";

/** URL fixa da placa: a mesma no QR Code e na tag NFC. */
export async function GET(request: Request, { params }: RouteContext<"/r/[code]">) {
  return handlePublicAccess(request, (await params).code);
}
