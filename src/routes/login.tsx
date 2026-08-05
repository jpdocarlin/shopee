import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Lock, Mail } from "lucide-react";

import { BrandWordmark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar · Shoppfy" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Já logado? Não faz sentido ficar na tela de login.
  useEffect(() => {
    if (initialized && session) {
      void navigate({ to: "/" });
    }
  }, [initialized, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    void navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandWordmark />
        </div>

        <div className="surface-card space-y-5 p-6">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-foreground">Entrar</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Acesse sua conta pra gerenciar seus produtos e comissões.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-muted-foreground">
          Ainda não tem conta? Fale com a equipe Shoppfy pra liberar seu acesso.
        </p>
      </div>
    </div>
  );
}
