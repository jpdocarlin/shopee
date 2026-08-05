import { createFileRoute } from "@tanstack/react-router";
import { Percent } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões · Shoppfy" },
      {
        name: "description",
        content: "Regras, faixas e valores de comissão por marketplace e categoria.",
      },
      { property: "og:title", content: "Comissões · Shoppfy" },
      {
        property: "og:description",
        content: "Regras, faixas e valores de comissão por marketplace e categoria.",
      },
    ],
  }),
  component: ComissoesPage,
});

function ComissoesPage() {
  const t = useT();
  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Comissões")}
        description={t("Regras, faixas e valores de comissão por marketplace e categoria.")}
      />
      <ModulePlaceholder
        icon={Percent}
        title="Motor de comissões"
        summary="Modele regras por categoria, campanha e período de apuração."
        capabilities={[
          "Regras por categoria",
          "Faixas progressivas",
          "Simulador de ganhos",
          "Histórico de mudanças",
          "Conciliação",
        ]}
      />
    </div>
  );
}
