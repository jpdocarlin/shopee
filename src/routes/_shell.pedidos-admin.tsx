import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AdminPedidosList } from "@/components/pedidos/admin-pedidos-list";
import { useIsOwner } from "@/lib/owner";
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
  const isOwner = useIsOwner();
  const navigate = useNavigate();

  // Rota exclusiva do dono. Se alguém que não é admin cair aqui (link direto,
  // etc.), manda pro Dashboard — a RLS já bloquearia os dados de qualquer
  // forma, mas nem a tela deve aparecer pra quem não é dono.
  useEffect(() => {
    if (initialized && !isOwner) {
      void navigate({ to: "/" });
    }
  }, [initialized, isOwner, navigate]);

  if (!initialized || !isOwner) {
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
