"use client";

import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** Campo de formulário com rótulo, ajuda e mensagem de erro acessível. */
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={id}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </FieldLabel>
      {children}
      {hint && !error && <FieldDescription>{hint}</FieldDescription>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (success) {
    return (
      <Alert role="status">
        <AlertDescription>{success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
