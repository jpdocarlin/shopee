import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/shared/page-header";
import { CriarAnuncio } from "@/components/anuncio/criar-anuncio";

const DESCRIPTION =
  "Monte o seu próprio anúncio pra vender como lojista, sem precisar ser afiliado.";

export const Route = createFileRoute("/_shell/criar-anuncio")({
  head: () => ({
    meta: [
      { title: "Criar Anúncio · Shoppfy" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Criar Anúncio · Shoppfy" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: CriarAnuncioPage,
});

function CriarAnuncioPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="Criar Anúncio"
        description="Escolha um produto, defina a sua margem e leve título, descrição, palavras-chave e foto prontos pra publicar na sua loja. Aqui você vende como lojista — não precisa ser afiliado."
      />
      <CriarAnuncio />
    </div>
  );
}
