import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AccessBlockedScreen } from "@/components/auth/access-blocked-screen";
import { AppShell } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/motion/page-transition";
import { useAuthStore } from "@/stores/auth-store";
import { useIsOwner, useIsPedidosAdmin } from "@/lib/owner";
import { isAccessBlocked } from "@/lib/access";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ShellLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const isOwner = useIsOwner();
  const isPedidosAdmin = useIsPedidosAdmin();

  // Sem sessão -> manda pro login. Sessão logada mas ainda não completou o
  // perfil (onboarding_done=false) -> primeira parada obrigatória é Configurações.
  // Conta com a role pedidos_admin (e que não é o dono) só pode ver /pedidos-admin —
  // qualquer outra rota redireciona pra lá.
  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      void navigate({ to: "/login" });
      return;
    }
    if (profile && isPedidosAdmin && !isOwner && pathname !== "/pedidos-admin") {
      void navigate({ to: "/pedidos-admin" });
      return;
    }
    if (profile && !profile.onboarding_done && pathname !== "/configuracoes") {
      void navigate({ to: "/configuracoes" });
    }
  }, [initialized, session, profile, isPedidosAdmin, isOwner, pathname, navigate]);

  if (!initialized || !session) {
    return <FullScreenLoader />;
  }

  // Sem pagamento em dia (mensal não pago, reembolso, chargeback): no lugar do
  // app, mostra a tela pra renovar. Contas de operação (dono/pedidos) nunca caem aqui.
  if (!isOwner && !isPedidosAdmin && isAccessBlocked(profile)) {
    return <AccessBlockedScreen reason={profile?.access_block_reason ?? null} />;
  }

  return (
    <AppShell>
      <PageTransition routeKey={pathname}>
        <Outlet />
      </PageTransition>
    </AppShell>
  );
}
