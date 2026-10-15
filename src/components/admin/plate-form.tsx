"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormField, FormMessage } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PLATE_CODE_MAX_LENGTH, PLATE_CODE_RULE } from "@/lib/plate-code";
import { PLATE_TYPE_LABEL } from "@/lib/targets";
import { useApi } from "@/hooks/use-api";
import type { Plate, PlateType } from "@/types/domain";

type ClientOption = { id: string; name: string };

export function PlateForm({
  plate,
  clients,
  defaultClientId,
  nextCode,
}: {
  plate?: Plate;
  clients: ClientOption[];
  defaultClientId?: string;
  /** Código que a nova placa vai receber (próximo número da sequência). */
  nextCode?: string;
}) {
  const [clientId, setClientId] = useState(plate?.clientId ?? defaultClientId ?? "");
  const [name, setName] = useState(plate?.name ?? "");
  const [serialNumber, setSerialNumber] = useState(plate?.serialNumber ?? "");
  const [type, setType] = useState<PlateType>(plate?.type ?? "QR_NFC");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [code, setCode] = useState(plate?.code ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const { call, pending } = useApi();
  const router = useRouter();

  const err = (key: string) => fields[key];
  const aria = (key: string) => ({ "aria-invalid": err(key) ? true : undefined, "aria-describedby": err(key) ? `${key}-error` : undefined });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const base = { clientId, name, serialNumber, type };
    const result = plate
      ? await call<{ plate: Plate }>("PATCH", `/api/admin/plates/${plate.id}`, { ...base, code, version: plate.version })
      : await call<{ plate: Plate }>("POST", "/api/admin/plates", { ...base, destinationUrl: destinationUrl || null });
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    if (plate) {
      setMessage({ success: "Alterações salvas." });
      router.refresh();
    } else {
      router.push(`/admin/plates/${result.data.plate.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormMessage error={message.error} success={message.success} />
      <div className="grid gap-4 md:grid-cols-2">
        {plate ? (
          <FormField
            id="code"
            label="Código do link"
            error={err("code")}
            required
            hint={
              code.trim().toLowerCase() !== plate.code
                ? `O link antigo /r/${plate.code} continuará funcionando e redirecionando para esta placa.`
                : PLATE_CODE_RULE
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-sm">/r/</span>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={PLATE_CODE_MAX_LENGTH} required {...aria("code")} />
            </div>
          </FormField>
        ) : (
          nextCode && (
            <div className="bg-muted rounded-md p-3 text-sm md:col-span-2">
              Link desta placa: <code className="font-mono">/r/{nextCode}</code> (número automático; pode ser alterado depois de criada).
            </div>
          )
        )}
        <FormField id="clientId" label="Cliente" error={err("clientId")} required>
          <NativeSelect id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required {...aria("clientId")}>
            <NativeSelectOption value="">Selecione…</NativeSelectOption>
            {clients.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="name" label="Nome da placa" error={err("name")} required hint="Ex.: Balcão loja Centro">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required {...aria("name")} />
        </FormField>
        <FormField id="type" label="Tipo" error={err("type")} required>
          <NativeSelect id="type" value={type} onChange={(e) => setType(e.target.value as PlateType)} {...aria("type")}>
            {(Object.keys(PLATE_TYPE_LABEL) as PlateType[]).map((t) => (
              <NativeSelectOption key={t} value={t}>
                {PLATE_TYPE_LABEL[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="serialNumber" label="Número de série" error={err("serialNumber")}>
          <Input id="serialNumber" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} maxLength={64} {...aria("serialNumber")} />
        </FormField>
        {!plate && (
          <FormField
            id="destinationUrl"
            label="Destino inicial"
            error={err("destinationUrl")}
            hint="Opcional. Usado para QR e NFC; pode ser alterado depois a qualquer momento."
          >
            <Input
              id="destinationUrl"
              type="url"
              placeholder="https://"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              maxLength={2048}
              {...aria("destinationUrl")}
            />
          </FormField>
        )}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : plate ? "Salvar alterações" : "Criar placa"}
        </Button>
      </div>
    </form>
  );
}
