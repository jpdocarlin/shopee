// Server functions (RPC) pra Passo 5 do Criar Anúncio publicar direto na API
// oficial do Mercado Livre — categoria (via preditor oficial, ver
// predictCategory em mercadolivre-api.server.ts) e a publicação em si.
// Espelha shopee-product.functions.ts. Protegido por `requireSupabaseAuth`
// (precisa estar logado); a partir daí cada usuário só opera na PRÓPRIA
// loja Mercado Livre conectada.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Diferente da Shopee (que expõe uma lista inteira de categorias pro
// front casar por palavra-chave em shopee-category-match.ts), o Mercado
// Livre já devolve a categoria certa pronta a partir do preditor oficial —
// não precisa buscar/andar por uma árvore inteira aqui. Recebe o título do
// produto e devolve a categoria prevista (ou null, sem match confiável).
export const predictMercadoLivreCategory = createServerFn({ method: "GET" })
  .validator((data: { title: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { predictCategory } = await import("@/lib/mercadolivre-api.server");

    const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
    const prediction = await predictCategory(accessToken, data.title);
    return prediction;
  });

type PublishInput = {
  categoryId: string;
  itemName: string;
  description: string;
  priceReais: number;
  stock: number;
  imageUrl: string;
  // Link da página do produto na C7Drop — usado pra buscar a galeria real
  // de fotos na hora de publicar, igual no fluxo da Shopee.
  productUrl: string;
  // Pra gravar em Meus anúncios: produto do catálogo e custo no momento.
  productId?: string;
  costCents?: number;
};

export const publishMercadoLivreProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: PublishInput) => data)
  .handler(async ({ context, data }) => {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { getCategoryAttributes, buildMandatoryAttributeList, emptyGtinReason, publishProduct } =
      await import("@/lib/mercadolivre-api.server");
    const { getC7DropGalleryImages } = await import("@/lib/c7drop-images.server");

    const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);

    // Junta a foto de capa com a galeria real do produto na C7Drop (até 5
    // fotos) — o ML aceita URL direto no corpo do POST /items, sem precisar
    // subir bytes pra um endpoint de upload separado (diferente da Shopee).
    const galleryUrls = await getC7DropGalleryImages(data.productUrl);
    const imageUrls = [data.imageUrl, ...galleryUrls.filter((url) => url !== data.imageUrl)];

    // Cada categoria do ML exige um conjunto diferente de atributos
    // obrigatórios (ex.: Marca/Modelo em Celulares) — resolve
    // automaticamente, igual à Shopee. Falhando a busca, segue sem
    // atributos em vez de travar a publicação inteira.
    let attributeList: ReturnType<typeof buildMandatoryAttributeList> = [];
    try {
      const attributes = await getCategoryAttributes(accessToken, data.categoryId);
      attributeList = buildMandatoryAttributeList(attributes);
    } catch {
      // categoria pode não ter atributos obrigatórios — segue sem eles.
    }

    const publish = (attrs: typeof attributeList) =>
      publishProduct({
        accessToken,
        categoryId: data.categoryId,
        itemName: data.itemName,
        description: data.description,
        priceReais: data.priceReais,
        stock: data.stock,
        imageUrls,
        attributeList: attrs,
      });

    let result: Awaited<ReturnType<typeof publishProduct>>;
    try {
      result = await publish(attributeList);
    } catch (err) {
      // Categoria pediu GTIN (código de barras) e a lista de atributos não
      // trouxe o EMPTY_GTIN_REASON: tenta de novo informando "sem código".
      const msg = err instanceof Error ? err.message : String(err);
      if (!/GTIN/i.test(msg) || attributeList.some((a) => a.id === "EMPTY_GTIN_REASON")) throw err;
      result = await publish([...attributeList, emptyGtinReason()]);
    }

    if (result.itemId) {
      const { recordPublishedListing } = await import("@/lib/listings.server");
      await recordPublishedListing({
        userId: context.userId,
        marketplace: "mercado-livre",
        externalId: String(result.itemId),
        productId: data.productId ?? null,
        title: data.itemName,
        imageUrl: data.imageUrl,
        permalink: result.permalink,
        priceCents: Math.round(data.priceReais * 100),
        costCents: data.costCents ?? null,
      }).catch((err) => console.error("[listings] falha ao gravar:", err));
    }

    return { itemId: result.itemId, permalink: result.permalink };
  });
