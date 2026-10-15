import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/admin/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { publicPath } from "@/lib/targets";
import { getApp } from "@/server/container";
import { effectiveTarget, resolveAccess } from "@/server/redirects/resolve";

export const metadata = { title: "Links" };

export default async function LinksPage({ searchParams }: PageProps<"/admin/links">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const app = await getApp();
  const plates = app.plates.list({ q });
  const now = new Date();
  const clientName = new Map(app.clients.list({ includeArchived: true }).map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Links" description="Destino atual de cada link de placa (QR Code e NFC usam o mesmo link). Para editar, abra a placa." />

      <form method="get" className="mb-4 flex flex-wrap gap-3" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar placa, código ou cliente" className="max-w-sm" aria-label="Buscar links" />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {plates.length === 0 ? (
        <EmptyState>Nenhum link encontrado.</EmptyState>
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Destino atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plates.map((plate) => {
                const resolution = resolveAccess(plate, now);
                const scheduled = effectiveTarget(plate, now).schedule !== null;
                return (
                  <TableRow key={plate.id}>
                    <TableCell className="whitespace-nowrap">
                      <code className="text-xs">{publicPath(plate.code)}</code>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/plates/${plate.id}`} className="font-medium hover:underline">
                        {plate.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">{clientName.get(plate.clientId)}</p>
                    </TableCell>
                    <TableCell className="max-w-md text-sm break-all">
                      {resolution.outcome === "unavailable" ? (
                        <Badge variant="outline">Indisponível</Badge>
                      ) : resolution.outcome === "page" ? (
                        "Página de múltiplos links"
                      ) : (
                        resolution.url
                      )}
                      {scheduled && resolution.outcome !== "unavailable" && (
                        <Badge variant="secondary" className="ml-2">
                          Agendado
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
