import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AdminPedidosList } from "@/components/pedidos/admin-pedidos-list";
import { useIsPedidosAdmin } from "@/lib/owner";
import { useAuthStore } from "@/stores/auth-store";

const DESCRIPTION = "Todos os pedidos enviados pelos revendedores, com dados de contato.";

export const Route = createFileRoute("/_shell/pedidos-admin")({
  head: () => ({
    meta: [{ title: "Pedidos (Admin) · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: PedidosAdminPage,
});

function PedidosAdminPage() {
  const initialized = useAuthStore((s) => s.initialized);
  const isPedidosAdmin = useIsPedidosAdmin();
  const navigate = useNavigate();

  // Rota exclusiva de quem tem a role pedidos_admin. Se alguém sem essa role
  // cair aqui (link direto, etc.), manda pro Dashboard — a RLS já bloquearia
  // os dados de qualquer forma, mas nem a tela deve aparecer.
  useEffect(() => {
    if (initialized && !isPedidosAdmin) {
      void navigate({ to: "/" });
    }
  }, [initialized, isPedidosAdmin, navigate]);

  if (!initialized || !isPedidosAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Pedidos (Admin)"
        description="Todos os pedidos enviados pelos revendedores do Shoppfy: produto, valores, quem fez e os anexos de etiqueta e comprovante do PIX."
      />
      <AdminPedidosList />
    </div>
  );
}
