import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RecordStatus } from "@/types/domain";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  return status === "active" ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Arquivado</Badge>;
}

export function Section({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card rounded-xl border p-5 shadow-xs", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{children}</p>;
}

/** Linha "rótulo: valor" para telas de detalhe. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm break-words">{children ?? "—"}</dd>
    </div>
  );
}
