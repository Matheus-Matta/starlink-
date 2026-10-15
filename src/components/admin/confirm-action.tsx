"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

/** Botão que confirma em um diálogo e então chama uma API do painel. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  url,
  method = "POST",
  body,
  variant = "outline",
  destructive,
  redirectTo,
  icon,
}: {
  label: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  url: string;
  method?: "POST" | "DELETE" | "PUT";
  body?: unknown;
  variant?: "outline" | "destructive" | "ghost" | "secondary";
  destructive?: boolean;
  redirectTo?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { call, pending } = useApi();
  const router = useRouter();

  async function confirm() {
    setError(null);
    const result = await call(method, url, body);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (setOpen(next), setError(null))}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size="sm">
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            variant={destructive ? "destructive" : "default"}
            onClick={(event) => {
              event.preventDefault(); // mantém o diálogo aberto até a resposta
              void confirm();
            }}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
