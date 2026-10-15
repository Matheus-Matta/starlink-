import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

import AuthBackgroundShape from "@/assets/svg/auth-background-shape";
import Logo from "@/components/shadcn-studio/logo";
import LoginForm from "@/components/shadcn-studio/blocks/login-page-01/login-form";

const Login = () => {
  return (
    <div className="relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8">
      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <div className="absolute" aria-hidden="true">
        <AuthBackgroundShape />
      </div>

      <Card className="z-1 w-full border-none shadow-md sm:max-w-lg">
        <CardHeader className="gap-6">
          <Logo className="gap-3" />

          <div>
            <CardTitle className="mb-1.5 text-2xl">Acesso administrativo</CardTitle>
            <CardDescription className="text-base">
              Gerencie clientes, placas e links de QR Code e NFC.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
