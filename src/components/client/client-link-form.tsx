"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormField, FormMessage } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";

export function ClientLinkForm({ plateId, initialVersion, initialActive, initialUrl }: { plateId: string; initialVersion: number; initialActive: boolean; initialUrl: string }) {
  const [version, setVersion] = useState(initialVersion);
  const [active, setActive] = useState(initialActive);
  const [destinationUrl, setDestinationUrl] = useState(initialUrl);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const { call, pending } = useApi();
  const router = useRouter();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const result = await call<{ plate: { version: number } }>("PATCH", `/api/client/plates/${plateId}/routing`, {
      version,
      active,
      destinationUrl,
    });
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    setVersion(result.data.plate.version);
    setMessage({ success: "Redirecionamento atualizado." });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <FormMessage error={message.error} success={message.success} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={active} onCheckedChange={(value) => setActive(value === true)} />
        Link ativo
      </label>
      <FormField id={`destination-${plateId}`} label="URL de redirecionamento" error={fields.destinationUrl} hint="Deixe vazio para não redirecionar. Use uma URL completa iniciada por https://.">
        <Input
          id={`destination-${plateId}`}
          type="url"
          inputMode="url"
          placeholder="https://seusite.com.br"
          value={destinationUrl}
          onChange={(event) => setDestinationUrl(event.target.value)}
          maxLength={2048}
          aria-invalid={fields.destinationUrl ? true : undefined}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando…" : "Salvar link"}</Button>
      </div>
    </form>
  );
}
