import { z } from "zod";

import { AccessChart } from "@/components/admin/access-chart";
import { PageHeader, Section } from "@/components/admin/ui-bits";
import { ClientLinkForm } from "@/components/client/client-link-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { dayInTimeZone } from "@/lib/timezone";
import { publicPath } from "@/lib/targets";
import { getApp } from "@/server/container";
import { effectiveTarget, resolveAccess } from "@/server/redirects/resolve";
import { requireClientPage } from "@/server/security/guards";

export const metadata = { title: "Relatórios e links" };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const filtersSchema = z.object({
  period: z.enum(["7", "30", "90", "custom"]).catch("30"),
  from: z.string().regex(DAY_RE).optional().catch(undefined),
  to: z.string().regex(DAY_RE).optional().catch(undefined),
  plateId: z.uuid().optional().catch(undefined),
});

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const number = new Intl.NumberFormat("pt-BR");

export default async function ClientDashboard({ searchParams }: PageProps<"/cliente">) {
  const session = await requireClientPage();
  const app = await getApp();
  const client = app.clients.get(session.clientId);
  const filters = filtersSchema.parse(await searchParams);
  const today = dayInTimeZone(new Date(), app.config.timeZone);
  let from = shiftDay(today, -(Number(filters.period === "custom" ? 30 : filters.period) - 1));
  let to = today;
  if (filters.period === "custom" && filters.from && filters.to) {
    [from, to] = filters.from <= filters.to ? [filters.from, filters.to] : [filters.to, filters.from];
    if (shiftDay(from, 365) < to) from = shiftDay(to, -365);
  }

  const plates = app.plates.list({ clientId: session.clientId, includeArchived: true });
  const allowedPlateId = filters.plateId && plates.some((plate) => plate.id === filters.plateId) ? filters.plateId : undefined;
  const stats = app.stats.query({ from, to, clientId: session.clientId, plateId: allowedPlateId }, app.plateRepository.list());
  const plateById = new Map(plates.map((plate) => [plate.id, plate]));
  const now = new Date();
  const activePlates = plates.filter((plate) => plate.status === "active");
  const activeLinks = activePlates.filter((plate) => resolveAccess(plate, now).outcome !== "unavailable").length;

  return (
    <>
      <PageHeader title={`Olá, ${client.tradeName ?? client.name}`} description="Acompanhe os acessos e gerencie o destino dos links das suas placas." />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Placas ativas", activePlates.length],
          ["Links ativos", activeLinks],
          ["Acessos no período", stats.total],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-xl border p-4 shadow-xs">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{number.format(Number(value))}</p>
          </div>
        ))}
      </div>

      <Section title="Relatório de acessos" className="mt-6" description="Os dados abaixo incluem exclusivamente as suas placas.">
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">Período
            <NativeSelect name="period" defaultValue={filters.period}>
              <NativeSelectOption value="7">Últimos 7 dias</NativeSelectOption>
              <NativeSelectOption value="30">Últimos 30 dias</NativeSelectOption>
              <NativeSelectOption value="90">Últimos 90 dias</NativeSelectOption>
              <NativeSelectOption value="custom">Personalizado</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">De<Input type="date" name="from" defaultValue={from} max={today} /></label>
          <label className="grid gap-1 text-sm">Até<Input type="date" name="to" defaultValue={to} max={today} /></label>
          <label className="grid gap-1 text-sm">Placa
            <NativeSelect name="plateId" defaultValue={allowedPlateId ?? ""}>
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {plates.map((plate) => <NativeSelectOption key={plate.id} value={plate.id}>{plate.name}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <Button type="submit">Aplicar</Button>
        </form>
        <div className="mb-5">
          <p className="text-muted-foreground text-sm">Total no período</p>
          <p className="text-2xl font-semibold tabular-nums">{number.format(stats.total)}</p>
        </div>
        <AccessChart data={stats.byDay} />
        {stats.topPlates.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-medium">Placas mais acessadas</h3>
            <ol className="mt-2 divide-y">
              {stats.topPlates.map(({ plateId, total }) => (
                <li key={plateId} className="flex justify-between gap-4 py-2 text-sm">
                  <span>{plateById.get(plateId)?.name ?? "Placa removida"}</span><span className="tabular-nums">{number.format(total)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section title="Minhas placas e links" className="mt-6" description="Você pode alterar somente os redirecionamentos das placas vinculadas à sua conta.">
        {plates.length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma placa vinculada.</p> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plates.map((plate) => {
              const current = resolveAccess(plate, now);
              const scheduled = effectiveTarget(plate, now).schedule !== null;
              const initialUrl = plate.routing.target.kind === "url" ? plate.routing.target.url : "";
              return (
                <article key={plate.id} className="rounded-lg border p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold">{plate.name}</h3><code className="text-muted-foreground text-xs">{publicPath(plate.code)}</code></div>
                    <div className="flex gap-2"><Badge variant="outline">{plate.status === "active" ? "Ativa" : "Arquivada"}</Badge>{scheduled && <Badge variant="secondary">Agendado</Badge>}</div>
                  </div>
                  <p className="text-muted-foreground mb-4 text-xs break-all">
                    Destino atual: {current.outcome === "redirect" ? current.url : current.outcome === "page" ? "Página de múltiplos links" : "Indisponível"}
                  </p>
                  {plate.status === "active" ? (
                    <ClientLinkForm plateId={plate.id} initialVersion={plate.version} initialActive={plate.routing.active} initialUrl={initialUrl} />
                  ) : <p className="text-muted-foreground text-sm">Uma placa arquivada não pode ser alterada.</p>}
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
