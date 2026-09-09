// Server functions (RPC) pra Passo 5 do Criar Anúncio publicar direto na
// API oficial da Shopee — categorias, canais de logística e a publicação em
// si. Implementação real fica em shopee-api.server.ts / shopee-connection.server.ts,
// carregada dinamicamente dentro do handler.
//
// Protegido por `requireSupabaseAuth` (precisa estar logado); a partir daí
// cada usuário só opera na PRÓPRIA loja Shopee conectada (context.userId é
// repassado pra getValidShopeeAccessToken em shopee-connection.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShopeeCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const { getCategoryList } = await import("@/lib/shopee-api.server");

    const { accessToken, shopId } = await getValidShopeeAccessToken(context.userId);
    const categories = await getCategoryList(accessToken, shopId);
    // 04/09/2026: a loja sandbox (Singapura) devolve algumas categorias-folha
    // sem category_name (string vazia/undefined) — o .sort() com
    // localeCompare quebrava a função inteira nesse caso (erro só apareceu
    // testando ao vivo). Em vez de filtrar fora (o que pode zerar a lista
    // inteira se NENHUMA vier com nome — já vimos isso acontecer), usa um
    // nome de fallback com o próprio id: a categoria continua selecionável e
    // válida pro product/add_item, só perde o nome bonito na UI.
    const result = categories
      .map((c) => ({ id: c.category_id, name: c.category_name || `Categoria ${c.category_id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return result;
  });

export const getShopeeLogisticsChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const { getLogisticsChannelList } = await import("@/lib/shopee-api.server");

    const { accessToken, shopId } = await getValidShopeeAccessToken(context.userId);
    const channels = await getLogisticsChannelList(accessToken, shopId);
    return channels.map((c) => ({ id: c.logistics_channel_id, name: c.logistics_channel_name }));
  });

// Busca o anúncio real já publicado (título, foto, preço, status) — usado
// pra mostrar "o que ficou de verdade na Shopee" logo depois de publicar,
// já que a loja sandbox não tem vitrine navegável pra conferir visualmente.
export const getShopeeItemPreview = createServerFn({ method: "GET" })
  .validator((data: { itemId: number }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const { getItemBaseInfo } = await import("@/lib/shopee-api.server");

    const { accessToken, shopId } = await getValidShopeeAccessToken(context.userId);
    const item = await getItemBaseInfo(accessToken, shopId, data.itemId);
    if (!item) return null;

    // 08/09/2026: descoberto ao vivo (primeiro anuncio publicado em producao)
    // -- o link "Ver na Shopee" ainda apontava pra tela de edicao do produto
    // no Seller Centre SANDBOX (seller.sandbox.test-stable.shopee.sg), mesmo
    // ja estando em Go-Live. Em ambiente live a Shopee tem vitrine publica de
    // verdade (shopee.com.br/produto-i.SHOP_ID.ITEM_ID), entao monta o link
    // pra ela direto aqui -- em sandbox nao existe essa vitrine (comentario
    // acima), entao mantem apontando pro Seller Centre sandbox nesse caso.
    const isLive = process.env.SHOPEE_ENV === "live";
    const productUrl = isLive
      ? `https://shopee.com.br/produto-i.${shopId}.${item.item_id}`
      : `https://seller.sandbox.test-stable.shopee.sg/portal/product/${item.item_id}`;

    return {
      itemId: item.item_id,
      name: item.item_name,
      status: item.item_status,
      priceReais: item.price_info?.[0]?.current_price ?? null,
      imageUrl: item.image?.image_url_list?.[0] ?? null,
      productUrl,
    };
  });

type PublishInput = {
  categoryId: number;
  itemName: string;
  description: string;
  priceReais: number;
  stock: number;
  weightKg: number;
  imageDataUrl: string | null;
  imageUrl: string;
  // Link da página do produto na C7Drop (ex.: c7drop.com.br/produto/{slug}) —
  // usado pra buscar a galeria real de fotos na hora de publicar.
  productUrl: string;
};

export const publishShopeeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: PublishInput) => data)
  .handler(async ({ context, data }) => {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const {
      uploadProductImage,
      uploadProductImageFromDataUrl,
      getLogisticsChannelList,
      getBrandList,
      getAttributeTree,
      buildMandatoryAttributeList,
      publishProduct,
    } = await import("@/lib/shopee-api.server");
    const { getC7DropGalleryImages } = await import("@/lib/c7drop-images.server");

    const { accessToken, shopId } = await getValidShopeeAccessToken(context.userId);

    // Confere logística ANTES de subir a imagem — sem canal habilitado o
    // add_item ia falhar de qualquer jeito, sem sentido gastar o upload.
    const channels = await getLogisticsChannelList(accessToken, shopId);
    if (channels.length === 0) {
      throw new Error(
        "Nenhum canal de logística habilitado nessa loja — habilite pelo menos um em Central do Vendedor > Envio antes de publicar.",
      );
    }

    // Shopee exige pelo menos 3 fotos por anúncio (e recusava os publicados só
    // com 1). Busca a galeria real do produto na C7Drop (até 5 fotos, ao vivo —
    // não fica uma cópia desatualizada salva em lugar nenhum) e soma com a foto
    // gerada por IA, se tiver uma. Cada upload é tentado individualmente
    // (Promise.allSettled) pra uma foto com link quebrado não derrubar a
    // publicação inteira — no pior caso sobra só a foto de capa.
    const galleryUrls = await getC7DropGalleryImages(data.productUrl);
    const uploadTasks = data.imageDataUrl
      ? [
          () => uploadProductImageFromDataUrl(accessToken, shopId, data.imageDataUrl as string),
          ...galleryUrls.map((url) => () => uploadProductImage(accessToken, shopId, url)),
        ]
      : [
          () => uploadProductImage(accessToken, shopId, data.imageUrl),
          ...galleryUrls
            .filter((url) => url !== data.imageUrl)
            .map((url) => () => uploadProductImage(accessToken, shopId, url)),
        ];

    const uploadResults = await Promise.allSettled(uploadTasks.map((task) => task()));
    const imageIds = uploadResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);

    if (imageIds.length === 0) {
      throw new Error(
        "Não foi possível subir nenhuma foto do produto pra Shopee — tente novamente.",
      );
    }

    // 04/09/2026: descoberto ao vivo — algumas categorias exigem `brand` no
    // add_item ("Brand information required"), outras não usam marca
    // nenhuma. get_brand_list devolve a lista válida PRA ESSA categoria;
    // prioriza a opção "No Brand" (existe pra maioria das categorias que só
    // querem *algum* valor preenchido) e cai pra primeira marca da lista se
    // não houver "No Brand" — sem isso o add_item quebra pra quem exige
    // marca. Se a categoria não usa marca, a lista vem vazia e segue sem
    // enviar o campo. get_brand_list falhando (categoria sem suporte a
    // marca nenhuma) não deve travar a publicação.
    let brand: { brandId: number; originalBrandName: string } | undefined;
    try {
      const brands = await getBrandList(accessToken, shopId, data.categoryId);
      const noBrand = brands.find((b) => /no brand/i.test(b.original_brand_name));
      const chosen = noBrand ?? brands[0];
      if (chosen) {
        brand = { brandId: chosen.brand_id, originalBrandName: chosen.original_brand_name };
      }
    } catch {
      // categoria pode não usar marca nenhuma — segue sem o campo.
    }

    // 04/09/2026: toda categoria da loja sandbox exige um conjunto
    // diferente de atributos obrigatórios (nomes de teste sem sentido, tipo
    // "hello world"). Busca a árvore de atributos e resolve automaticamente
    // cada um obrigatório (buildMandatoryAttributeList). Falhando a busca
    // (ou o shape da resposta não bater — getAttributeTree já degrada pra
    // lista vazia nesse caso), segue sem atributos em vez de travar a
    // publicação inteira.
    let attributeList: ReturnType<typeof buildMandatoryAttributeList> = [];
    try {
      const attributes = await getAttributeTree(accessToken, shopId, data.categoryId);
      attributeList = buildMandatoryAttributeList(attributes);
    } catch {
      // categoria pode não ter atributos obrigatórios — segue sem eles.
    }

    const result = await publishProduct({
      accessToken,
      shopId,
      categoryId: data.categoryId,
      itemName: data.itemName,
      description: data.description,
      originalPrice: data.priceReais,
      stock: data.stock,
      weightKg: data.weightKg,
      imageIds,
      logisticIds: channels.map((c) => c.logistics_channel_id),
      brand,
      attributeList,
    });

    const parsed = result as { response?: { item_id?: number } };
    return { itemId: parsed.response?.item_id ?? null };
  });
