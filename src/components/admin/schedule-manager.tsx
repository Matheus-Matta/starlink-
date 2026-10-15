"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";

import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, FormMessage } from "@/components/admin/form-bits";
import { TargetInput, fromDraft, type TargetDraft } from "@/components/admin/target-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { describeTarget } from "@/lib/targets";
import { formatDateTime } from "@/lib/timezone";
import { useApi } from "@/hooks/use-api";
import type { Plate } from "@/types/domain";

const TIME_ZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Rio_Branco", "America/Noronha", "UTC"];

export function ScheduleManager({
  plate,
  defaultTimeZone,
  nowIso,
  winningIds,
}: {
  plate: Plate;
  defaultTimeZone: string;
  /** Instante de referência do servidor, para classificar os agendamentos. */
  nowIso: string;
  /** Agendamentos que estão de fato definindo o destino agora. */
  winningIds: string[];
}) {
  const [target, setTarget] = useState<TargetDraft>({ kind: "url", url: "" });
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timeZone, setTimeZone] = useState(defaultTimeZone);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const { call, pending } = useApi();
  const router = useRouter();
  const now = Date.parse(nowIso);
  const zones = TIME_ZONES.includes(defaultTimeZone) ? TIME_ZONES : [defaultTimeZone, ...TIME_ZONES];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const result = await call("POST", `/api/admin/plates/${plate.id}/schedules`, {
      version: plate.version,
      target: fromDraft(target),
      startsAt,
      endsAt: endsAt || null,
      timeZone,
      note,
    });
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    setMessage({ success: "Agendamento criado." });
    setStartsAt("");
    setEndsAt("");
    setNote("");
    router.refresh();
  }

  const schedules = [...plate.schedules].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="grid gap-6">
      {schedules.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum agendamento.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {schedules.map((s) => {
            const started = Date.parse(s.startsAt) <= now;
            const ended = s.endsAt !== null && Date.parse(s.endsAt) <= now;
            const status = ended ? "Encerrado" : started ? (winningIds.includes(s.id) ? "Em vigor" : "Sobreposto") : "Agendado";
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <Badge variant={status === "Em vigor" ? "default" : "outline"}>{status}</Badge>
                    <span className="break-all">{describeTarget(s.target)}</span>
                  </p>
                  <p className="text-muted-foreground mt-1">
                    De {formatDateTime(s.startsAt, s.timeZone)}
                    {s.endsAt ? ` até ${formatDateTime(s.endsAt, s.timeZone)}` : " (sem término)"} · {s.timeZone}
                  </p>
                  {s.note && <p className="text-muted-foreground mt-1">{s.note}</p>}
                </div>
                <ConfirmAction
                  label="Remover"
                  icon={<Trash2Icon />}
                  variant="ghost"
                  destructive
                  title="Remover agendamento?"
                  description="O destino deixará de mudar nesta data. A remoção fica registrada no histórico."
                  confirmLabel="Remover"
                  method="DELETE"
                  url={`/api/admin/plates/${plate.id}/schedules/${s.id}?version=${plate.version}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border p-4" noValidate>
        <p className="font-medium">Novo agendamento</p>
        <FormMessage error={message.error} success={message.success} />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="schedule-tz" label="Fuso horário" error={fields.timeZone}>
            <NativeSelect id="schedule-tz" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {zones.map((z) => (
                <NativeSelectOption key={z} value={z}>
                  {z}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="schedule-start" label="Início" error={fields.startsAt} required>
            <Input id="schedule-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </FormField>
          <FormField id="schedule-end" label="Término" error={fields.endsAt} hint="Opcional. Sem término, o destino agendado vale até outro agendamento.">
            <Input id="schedule-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </FormField>
        </div>
        <FormField id="schedule-target" label="Destino" error={fields["target.url"]} required>
          <TargetInput id="schedule-target" value={target} onChange={setTarget} error={fields["target.url"]} />
        </FormField>
        <FormField id="schedule-note" label="Observação" error={fields.note}>
          <Input id="schedule-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </FormField>
        <p className="text-muted-foreground text-xs">
          Regra: com agendamentos sobrepostos, vale o de início mais recente. Ao terminar, volta o destino padrão (ou o próximo agendamento
          em vigor). A troca é calculada a cada acesso, então funciona mesmo após reinícios do servidor.
        </p>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Agendar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
