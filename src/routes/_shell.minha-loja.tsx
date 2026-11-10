import { createFileRoute } from "@tanstack/react-router";

import { MarketplaceStore } from "@/components/loja/marketplace-store";
import { PageHeader } from "@/components/shared/page-header";

const DESCRIPTION =
  "Edite a sua loja da Shopee e do Mercado Livre sem sair do Shoppfy. O que você salvar aqui vai direto pra sua loja.";

// Minha Loja (10/11/2026): edição da loja que o usuário já tem dentro dos
// marketplaces, pela API oficial (ver marketplace-store.functions.ts).
export const Route = createFileRoute("/_shell/minha-loja")({
  head: () => ({
    meta: [{ title: "Minha Loja · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: MinhaLojaPage,
});

function MinhaLojaPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Minha Loja" description={DESCRIPTION} />
      <MarketplaceStore />
    </div>
  );
}
