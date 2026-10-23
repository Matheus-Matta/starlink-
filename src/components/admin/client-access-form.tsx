"use client";

import { useState, type FormEvent } from "react";

import { FormField, FormMessage } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";

type AccessStatus = { enabled: boolean; hasPassword: boolean; updatedAt: string | null };

export function ClientAccessForm({ clientId, email, initial, disabled = false }: { clientId: string; email: string | null; initial: AccessStatus; disabled?: boolean }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const { call, pending } = useApi();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const body = { enabled, ...(password ? { password } : {}) };
    const result = await call<{ access: AccessStatus }>("PUT", `/api/admin/clients/${clientId}/access`, body);
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    setHasPassword(result.data.access.hasPassword);
    setPassword("");
    setMessage({ success: enabled ? "Acesso ao portal atualizado." : "Acesso ao portal desativado." });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
      <FormMessage error={message.error} success={message.success} />
      <p className="text-muted-foreground text-sm">
        Login do cliente: <strong className="text-foreground">{email ?? "cadastre um e-mail acima"}</strong>
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} disabled={disabled || !email} />
        Permitir acesso ao portal do cliente
      </label>
      <FormField
        id="client-password"
        label={hasPassword ? "Nova senha (opcional)" : "Senha inicial"}
        error={fields.password}
        hint="Mínimo de 12 caracteres. Ao trocar a senha, sessões abertas são encerradas."
        required={enabled && !hasPassword}
      >
        <Input
          id="client-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          maxLength={256}
          disabled={disabled}
          aria-invalid={fields.password ? true : undefined}
        />
      </FormField>
      <div>
        <Button type="submit" disabled={disabled || pending || (enabled && !hasPassword && password.length < 12)}>
          {pending ? "Salvando…" : "Salvar acesso"}
        </Button>
      </div>
    </form>
  );
}
