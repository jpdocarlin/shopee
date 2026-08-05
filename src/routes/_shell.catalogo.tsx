import { createFileRoute } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo · Shoppfy" },
      {
        name: "description",
        content: "Coleções e vitrines publicáveis montadas a partir dos seus produtos.",
      },
      { property: "og:title", content: "Catálogo · Shoppfy" },
      {
        property: "og:description",
        content: "Coleções e vitrines publicáveis montadas a partir dos seus produtos.",
      },
    ],
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  const t = useT();
  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Catálogo")}
        description={t("Coleções e vitrines publicáveis montadas a partir dos seus produtos.")}
      />
      <ModulePlaceholder
        icon={BookMarked}
        title="Vitrines de conversão"
        summary="Monte coleções curadas e distribua com links rastreáveis."
        capabilities={[
          "Coleções curadas",
          "Links rastreáveis",
          "Página pública",
          "Ordenação manual",
          "Temas de vitrine",
        ]}
      />
    </div>
  );
}
