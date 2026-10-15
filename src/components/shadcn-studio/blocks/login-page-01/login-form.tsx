"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useApi } from "@/hooks/use-api";

const LoginForm = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, pending } = useApi();
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await call("POST", "/api/auth/login", { password });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPassword("");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field className="gap-1">
          <FieldLabel htmlFor="password" className="leading-5">
            Senha
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="password"
              name="password"
              type={isVisible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={256}
              required
              autoFocus
            />
            <InputGroupAddon align="inline-end" className="pr-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsVisible((prevState) => !prevState)}
                className="text-muted-foreground rounded-l-none hover:bg-transparent"
              >
                {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                <span className="sr-only">{isVisible ? "Ocultar senha" : "Mostrar senha"}</span>
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <Button className="w-full" type="submit" disabled={pending || password.length === 0}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
};

export default LoginForm;
