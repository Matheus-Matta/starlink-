import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maskDocument } from "@/lib/document";
import { getApp } from "@/server/container";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const includeArchived = params.archived === "1";
  const app = await getApp();
  const clients = app.clients.list({ q, includeArchived });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes. Arquivar preserva o histórico e as placas."
        actions={
          <Button asChild>
            <Link href="/admin/clients/new">
              <PlusIcon />
              Novo cliente
            </Link>
          </Button>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail, telefone ou CPF/CNPJ" className="max-w-sm" aria-label="Buscar clientes" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="size-4" />
          Incluir arquivados
        </label>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {clients.length === 0 ? (
        <EmptyState>{q ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente cadastrado ainda."}</EmptyState>
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">CPF/CNPJ</TableHead>
                <TableHead className="hidden md:table-cell">Contato</TableHead>
                <TableHead className="text-right">Placas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/admin/clients/${client.id}`} className="font-medium hover:underline">
                      {client.name}
                    </Link>
                    {client.tradeName && <p className="text-muted-foreground text-xs">{client.tradeName}</p>}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{client.document ? maskDocument(client.document) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">{client.email ?? client.phone ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{client.plateCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
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
