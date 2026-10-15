"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormField, FormMessage } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDocument } from "@/lib/document";
import { useApi } from "@/hooks/use-api";
import type { Client } from "@/types/domain";

type Values = { name: string; tradeName: string; document: string; phone: string; email: string; contactName: string; notes: string; address: string};

const toValues = (c?: Client): Values => ({
  name: c?.name ?? "",
  tradeName: c?.tradeName ?? "",
  document: c?.document ? formatDocument(c.document) : "",
  phone: c?.phone ?? "",
  email: c?.email ?? "",
  contactName: c?.contactName ?? "",
  notes: c?.notes ?? "",
  address: c?.address ?? "",
});

export function ClientForm({ client }: { client?: Client }) {
  const [values, setValues] = useState<Values>(() => toValues(client));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const { call, pending } = useApi();
  const router = useRouter();

  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => fields[key];
  const aria = (key: string) => ({ "aria-invalid": err(key) ? true : undefined, "aria-describedby": err(key) ? `${key}-error` : undefined });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage({});
    setFields({});
    const result = client
      ? await call<{ client: Client }>("PATCH", `/api/admin/clients/${client.id}`, { ...values, version: client.version })
      : await call<{ client: Client }>("POST", "/api/admin/clients", values);
    if (!result.ok) {
      setFields(result.error.fields ?? {});
      setMessage({ error: result.error.message });
      return;
    }
    if (client) {
      setMessage({ success: "Alterações salvas." });
      router.refresh();
    } else {
      router.push(`/admin/clients/${result.data.client.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormMessage error={message.error} success={message.success} />
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="name" label="Nome / razão social" error={err("name")} required>
          <Input id="name" value={values.name} onChange={set("name")} maxLength={200} required {...aria("name")} />
        </FormField>
        <FormField id="tradeName" label="Nome fantasia" error={err("tradeName")}>
          <Input id="tradeName" value={values.tradeName} onChange={set("tradeName")} maxLength={200} {...aria("tradeName")} />
        </FormField>
        <FormField id="document" label="CPF/CNPJ" error={err("document")} hint="Opcional. Exibido mascarado nas listagens.">
          <Input id="document" value={values.document} onChange={set("document")} inputMode="numeric" maxLength={20} {...aria("document")} />
        </FormField>
        <FormField id="phone" label="Telefone" error={err("phone")}>
          <Input id="phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={30} {...aria("phone")} />
        </FormField>
        <FormField id="email" label="E-mail" error={err("email")}>
          <Input id="email" type="email" value={values.email} onChange={set("email")} maxLength={254} {...aria("email")} />
        </FormField>
        <FormField id="contactName" label="Responsável" error={err("contactName")}>
          <Input id="contactName" value={values.contactName} onChange={set("contactName")} maxLength={120} {...aria("contactName")} />
        </FormField>
      </div>
      <FormField id="address" label="Endereço" error={err("address")}>
        <Textarea
          id="address"
          value={values.address}
          onChange={set("address")}
          maxLength={500}
          rows={2}
          {...aria("address")}/>
      </FormField>
      <FormField id="notes" label="Observações" error={err("notes")} hint="Evite registrar dados pessoais desnecessários.">
        <Textarea id="notes" value={values.notes} onChange={set("notes")} maxLength={2000} rows={4} {...aria("notes")} />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : client ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}
