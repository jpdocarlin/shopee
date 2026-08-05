import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace · Shoppfy" },
      {
        name: "description",
        content: "Contas, canais e credenciais conectadas de Shopee e Mercado Livre.",
      },
      { property: "og:title", content: "Marketplace · Shoppfy" },
      {
        property: "og:description",
        content: "Contas, canais e credenciais conectadas de Shopee e Mercado Livre.",
      },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const t = useT();
  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Marketplace")}
        description={t("Contas, canais e credenciais conectadas de Shopee e Mercado Livre.")}
      />
      <ModulePlaceholder
        icon={Store}
        title="Canais conectados"
        summary="Centralize contas de afiliado e o status de sincronização de cada uma."
        capabilities={[
          "Contas Shopee",
          "Contas Mercado Livre",
          "Status de sincronização",
          "Rotação de credenciais",
          "Limites de API",
        ]}
      />
    </div>
  );
}
