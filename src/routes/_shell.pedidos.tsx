import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · Shoppfy" },
      {
        name: "description",
        content: "Vendas atribuídas aos seus links, com status e valor de comissão.",
      },
      { property: "og:title", content: "Pedidos · Shoppfy" },
      {
        property: "og:description",
        content: "Vendas atribuídas aos seus links, com status e valor de comissão.",
      },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const t = useT();
  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Pedidos")}
        description={t("Vendas atribuídas aos seus links, com status e valor de comissão.")}
      />
      <ModulePlaceholder
        icon={ShoppingCart}
        title="Atribuição de vendas"
        summary="Do clique ao pedido pago, com rastreio completo do funil."
        capabilities={[
          "Linha do tempo do pedido",
          "Status de aprovação",
          "Filtro por período",
          "Comissão prevista",
          "Exportação contábil",
        ]}
      />
    </div>
  );
}
