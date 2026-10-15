import Link from "next/link";
import { PlusIcon, UploadIcon } from "lucide-react";

import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATE_TYPE_LABEL, publicPath } from "@/lib/targets";
import { idSchema } from "@/lib/validation";
import { getApp } from "@/server/container";

export const metadata = { title: "Placas" };

export default async function PlatesPage({ searchParams }: PageProps<"/admin/plates">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const clientId = idSchema.safeParse(params.clientId).data;
  const includeArchived = params.archived === "1";
  const app = await getApp();
  const plates = app.plates.list({ q, clientId, includeArchived });
  const clients = app.clients.list({ includeArchived: true });
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        title="Placas"
        description="Cada placa tem URLs públicas permanentes; os destinos podem ser alterados a qualquer momento."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/plates/import">
                <UploadIcon />
                Importar CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/plates/new">
                <PlusIcon />
                Nova placa
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, série, código ou cliente" className="max-w-sm" aria-label="Buscar placas" />
        <NativeSelect name="clientId" defaultValue={clientId ?? ""} aria-label="Filtrar por cliente">
          <NativeSelectOption value="">Todos os clientes</NativeSelectOption>
          {clients
            .filter((c) => c.status === "active")
            .map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="size-4" />
          Incluir arquivadas
        </label>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {plates.length === 0 ? (
        <EmptyState>{q || clientId ? "Nenhuma placa encontrada." : "Nenhuma placa cadastrada ainda."}</EmptyState>
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plates.map((plate) => (
                <TableRow key={plate.id}>
                  <TableCell>
                    <Link href={`/admin/plates/${plate.id}`} className="font-medium hover:underline">
                      {plate.name}
                    </Link>
                    {plate.serialNumber && <p className="text-muted-foreground text-xs">Série {plate.serialNumber}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{clientName.get(plate.clientId) ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{PLATE_TYPE_LABEL[plate.type]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{publicPath(plate.code)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge status={plate.status} />
                      {plate.status === "active" && !plate.routing.active && <Badge variant="outline">Links desativados</Badge>}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
