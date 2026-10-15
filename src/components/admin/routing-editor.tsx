"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { FormField, FormMessage } from "@/components/admin/form-bits";
import { TargetInput, fromDraft, toDraft, type TargetDraft } from "@/components/admin/target-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PAGE_BUTTONS } from "@/lib/targets";
import { useApi } from "@/hooks/use-api";
import type { Plate } from "@/types/domain";

type ButtonDraft = { key: string; id?: string; label: string; url: string; active: boolean };

let keySeq = 0;
const nextKey = () => `b${++keySeq}`;

/** Editor do link da placa: destino (o mesmo para QR Code e NFC), ativação e página de múltiplos links. */
export function RoutingEditor({ plate }: { plate: Plate }) {
  const [active, setActive] = useState(plate.routing.active);
  const [target, setTarget] = useState<TargetDraft>(toDraft(plate.routing.target));
  const [title, setTitle] = useState(plate.routing.page.title);
  const [description, setDescription] = useState(plate.routing.page.description ?? "");
  const [buttons, setButtons] = useState<ButtonDraft[]>(() => plate.routing.page.buttons.map((b) => ({ ...b, key: nextKey() })));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const { call, pending } = useApi();
  const router = useRouter();

  const updateButton = (index: number, patch: Partial<ButtonDraft>) =>
    setButtons((list) => list.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  const move = (index: number, delta: number) =>
    setButtons((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const result = await call("PUT", `/api/admin/plates/${plate.id}/routing`, {
      version: plate.version,
      active,
      target: fromDraft(target),
      page: {
        title,
        description,
        buttons: buttons.map(({ id, label, url, active: on }) => ({ ...(id ? { id } : {}), label, url, active: on })),
      },
    });
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    setMessage({ success: "Link atualizado. A mudança vale imediatamente para novos acessos." });
    router.refresh();
  }

  const usesPage = target.kind === "page" || plate.schedules.some((s) => s.target.kind === "page");

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <FormMessage error={message.error} success={message.success} />

      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-0.5 size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>
          <span className="font-medium">Link ativo</span>
          <span className="text-muted-foreground block text-sm">Desativado, o link exibe “Link indisponível” (o código continua reservado).</span>
        </span>
      </label>

      <FormField id="target" label="Destino (QR Code e NFC)" error={fields["target.url"]}>
        <TargetInput id="target" value={target} onChange={setTarget} error={fields["target.url"]} />
      </FormField>

      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">Página de múltiplos links</legend>
        <p className="text-muted-foreground -mt-2 text-sm">
          {usesPage ? "Em uso pelo destino ou por um agendamento." : "Selecione “Página de múltiplos links” no destino para publicá-la."} Apenas
          texto e links são exibidos; HTML não é interpretado.
        </p>
        <FormField id="page-title" label="Título" error={fields["page.title"]} required>
          <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </FormField>
        <FormField id="page-description" label="Descrição" error={fields["page.description"]}>
          <Textarea id="page-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
        </FormField>

        <div className="grid gap-3">
          <p className="text-sm font-medium">Botões</p>
          {buttons.length === 0 && <p className="text-muted-foreground text-sm">Nenhum botão. Ex.: Instagram, Google Avaliações, WhatsApp.</p>}
          {buttons.map((button, index) => {
            const err = (k: string) => fields[`page.buttons.${index}.${k}`];
            return (
              <div key={button.key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_auto]">
                <Input
                  aria-label={`Texto do botão ${index + 1}`}
                  placeholder="Texto do botão"
                  value={button.label}
                  maxLength={60}
                  onChange={(e) => updateButton(index, { label: e.target.value })}
                  aria-invalid={err("label") ? true : undefined}
                />
                <Input
                  aria-label={`URL do botão ${index + 1}`}
                  type="url"
                  placeholder="https://"
                  value={button.url}
                  maxLength={2048}
                  onChange={(e) => updateButton(index, { url: e.target.value })}
                  aria-invalid={err("url") ? true : undefined}
                />
                <div className="flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-1.5 text-sm">
                    <input type="checkbox" className="size-4" checked={button.active} onChange={(e) => updateButton(index, { active: e.target.checked })} />
                    Ativo
                  </label>
                  <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUpIcon />
                    <span className="sr-only">Mover para cima</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={index === buttons.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDownIcon />
                    <span className="sr-only">Mover para baixo</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setButtons((list) => list.filter((_, i) => i !== index))}>
                    <Trash2Icon />
                    <span className="sr-only">Remover botão</span>
                  </Button>
                </div>
                {(err("label") || err("url")) && <p className="text-destructive text-sm sm:col-span-3">{err("label") ?? err("url")}</p>}
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={buttons.length >= MAX_PAGE_BUTTONS}
              onClick={() => setButtons((list) => [...list, { key: nextKey(), label: "", url: "", active: true }])}
            >
              <PlusIcon />
              Adicionar botão
            </Button>
          </div>
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar link"}
        </Button>
      </div>
    </form>
  );
}
