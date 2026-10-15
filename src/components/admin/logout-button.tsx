"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

export function LogoutButton() {
  const { call, pending } = useApi();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        await call("POST", "/api/auth/logout");
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOutIcon />
      Sair
    </Button>
  );
}
