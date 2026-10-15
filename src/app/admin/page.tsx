import Link from "next/link";
import { z } from "zod";

import { AccessChart } from "@/components/admin/access-chart";
import { PageHeader, Section } from "@/components/admin/ui-bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { dayInTimeZone } from "@/lib/timezone";
import { getApp } from "@/server/container";
import { resolveAccess } from "@/server/redirects/resolve";

export const metadata = { title: "Painel" };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const filtersSchema = z.object({
  period: z.enum(["7", "30", "90", "custom"]).catch("30"),
  from: z.string().regex(DAY_RE).optional().catch(undefined),
  to: z.string().regex(DAY_RE).optional().catch(undefined),
  clientId: z.uuid().optional().catch(undefined),
  plateId: z.uuid().optional().catch(undefined),
});

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const number = new Intl.NumberFormat("pt-BR");

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const app = await getApp();
  const filters = filtersSchema.parse(await searchParams);
  const today = dayInTimeZone(new Date(), app.config.timeZone);

  let from = shiftDay(today, -(Number(filters.period === "custom" ? 30 : filters.period) - 1));
  let to = today;
  if (filters.period === "custom" && filters.from && filters.to) {
    [from, to] = filters.from <= filters.to ? [filters.from, filters.to] : [filters.to, filters.from];
    if (shiftDay(from, 365) < to) from = shiftDay(to, -365); // limita a 1 ano
  }

  const now = new Date();
  const clients = app.clients.list();
  const plates = app.plates.list();
  const activeLinks = plates.filter((p) => resolveAccess(p, now).outcome !== "unavailable").length;

  const stats = app.stats.query(
    { from, to, clientId: filters.clientId, plateId: filters.plateId },
    app.plateRepository.list(),
  );
  const plateName = new Map(app.plateRepository.list().map((p) => [p.id, p]));
  const plateOptions = filters.clientId ? plates.filter((p) => p.clientId === filters.clientId) : plates;

  const tiles = [
    { label: "Clientes ativos", value: clients.length, href: "/admin/clients" },
    { label: "Placas ativas", value: plates.length, href: "/admin/plates" },
    { label: "Links ativos", value: activeLinks, href: "/admin/links" },
    { label: "Acessos no período", value: stats.total },
  ];

  return (
    <>
      <PageHeader title="Painel" description="Visão geral de clientes, placas, links e acessos." />

      {app.health.corruptFiles.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Arquivos de dados com falha de integridade</AlertTitle>
          <AlertDescription>
            {app.health.corruptFiles.length} arquivo(s) não passaram na verificação criptográfica e foram ignorados. Consulte os logs do
            servidor e restaure a partir de um backup.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-muted-foreground text-sm">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{number.format(tile.value)}</p>
            </>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="bg-card hover:bg-accent rounded-xl border p-4 shadow-xs transition-colors">
              {body}
            </Link>
          ) : (
            <div key={tile.label} className="bg-card rounded-xl border p-4 shadow-xs">
              {body}
            </div>
          );
        })}
      </div>

      <Section title="Acessos" className="mt-6" description="Contagens agregadas por dia. Não registramos IP nem dados do visitante.">
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Período
            <NativeSelect name="period" defaultValue={filters.period}>
              <NativeSelectOption value="7">Últimos 7 dias</NativeSelectOption>
              <NativeSelectOption value="30">Últimos 30 dias</NativeSelectOption>
              <NativeSelectOption value="90">Últimos 90 dias</NativeSelectOption>
              <NativeSelectOption value="custom">Personalizado</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            De
            <Input type="date" name="from" defaultValue={from} max={today} />
          </label>
          <label className="grid gap-1 text-sm">
            Até
            <Input type="date" name="to" defaultValue={to} max={today} />
          </label>
          <label className="grid gap-1 text-sm">
            Cliente
            <NativeSelect name="clientId" defaultValue={filters.clientId ?? ""}>
              <NativeSelectOption value="">Todos</NativeSelectOption>
              {clients.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            Placa
            <NativeSelect name="plateId" defaultValue={filters.plateId ?? ""}>
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {plateOptions.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit">Aplicar</Button>
          <Button variant="ghost" asChild>
            <Link href="/admin">Limpar</Link>
          </Button>
        </form>
        <p className="text-muted-foreground mb-4 text-xs">
          Para datas específicas, escolha “Personalizado”. QR Code e NFC usam o mesmo link, então os acessos são somados.
        </p>

        <div className="mb-6 text-sm">
          <p className="text-muted-foreground">Total no período</p>
          <p className="text-2xl font-semibold tabular-nums">{number.format(stats.total)}</p>
        </div>

        <AccessChart data={stats.byDay} />
      </Section>

      <Section title="Placas mais acessadas" className="mt-6">
        {stats.topPlates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum acesso no período.</p>
        ) : (
          <ol className="divide-y">
            {stats.topPlates.map(({ plateId, total }) => {
              const plate = plateName.get(plateId);
              return (
                <li key={plateId} className="flex items-center justify-between gap-4 py-2 text-sm">
                  {plate ? (
                    <Link href={`/admin/plates/${plate.id}`} className="hover:underline">
                      {plate.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Placa removida</span>
                  )}
                  <span className="tabular-nums">{number.format(total)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}
