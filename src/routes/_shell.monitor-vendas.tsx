import { createFileRoute } from "@tanstack/react-router";

import { SalesLiveboard } from "@/components/liveboard/sales-liveboard";
import { PageHeader } from "@/components/shared/page-header";

export const Route = createFileRoute("/_shell/monitor-vendas")({
  head: () => ({
    meta: [
      { title: "Monitor de vendas ao vivo · Shoppfy" },
      {
        name: "description",
        content:
          "Painel ao vivo de vendas do dia: total faturado, métricas principais, tendência por hora e top 5 produtos.",
      },
      { property: "og:title", content: "Monitor de vendas ao vivo · Shoppfy" },
      {
        property: "og:description",
        content:
          "Total faturado hoje, métricas principais, tendência de vendas por hora e ranking de produtos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitorVendasPage,
});

function MonitorVendasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitor de vendas ao vivo"
        description="Réplica do liveboard: total do dia, métricas principais, tendência por hora e top 5 produtos."
      />
      <SalesLiveboard />
    </div>
  );
}