"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Target } from "@/types/domain";

/** Rascunho editável de um destino (a URL é mantida mesmo ao alternar o tipo). */
export type TargetDraft = { kind: Target["kind"]; url: string };

export const toDraft = (target: Target): TargetDraft => ({ kind: target.kind, url: target.kind === "url" ? target.url : "" });

export const fromDraft = (draft: TargetDraft): Target => (draft.kind === "url" ? { kind: "url", url: draft.url } : { kind: draft.kind });

export function TargetInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: TargetDraft;
  onChange: (next: TargetDraft) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <NativeSelect
        id={`${id}-kind`}
        aria-label="Tipo de destino"
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as Target["kind"] })}
        className="sm:w-56"
      >
        <NativeSelectOption value="url">Redirecionar para URL</NativeSelectOption>
        <NativeSelectOption value="page">Página de múltiplos links</NativeSelectOption>
        <NativeSelectOption value="none">Sem destino</NativeSelectOption>
      </NativeSelect>
      {value.kind === "url" && (
        <Input
          id={id}
          type="url"
          placeholder="https://"
          value={value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          maxLength={2048}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="flex-1"
        />
      )}
    </div>
  );
}
