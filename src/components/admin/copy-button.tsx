"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard indisponível (ex.: HTTP sem localhost); o valor continua visível para cópia manual.
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="sr-only">{copied ? "Copiado" : label}</span>
    </Button>
  );
}
