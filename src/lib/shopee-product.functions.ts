// Server functions (RPC) pra Passo 5 do Criar Anúncio publicar direto na
// API oficial da Shopee — categorias, canais de logística e a publicação em
// si. Implementação real fica em shopee-api.server.ts / shopee-connection.server.ts,
// carregada dinamicamente dentro do handler.
//
// Protegido em duas camadas: `requireSupabaseAuth` (precisa estar logado) +
// `assertShopeeOwner` (só o dono da loja Shopee conectada pode publicar —
// ver o comentário em shopee-connection.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShopeeCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertShopeeOwner, getValidShopeeAccessToken } =
      await import("@/lib/shopee-connection.server");
    const { getCategoryList } = await import("@/lib/shopee-api.server");

    await assertShopeeOwner(context.userId);
    const { accessToken, shopId } = await getValidShopeeAccessToken();
    const categories = await getCategoryList(accessToken, shopId);
    // 04/09/2026: a loja sandbox (Singapura) devolve algumas categorias-folha
    // sem category_name (string vazia/undefined) — o .sort() com
    // localeCompare quebrava a função inteira nesse caso (erro só apareceu
    // testando ao vivo). Em vez de filtrar fora (o que pode zerar a lista
    // inteira se NENHUMA vier com nome — já vimos isso acontecer), usa um
    // nome de fallback com o próprio id: a categoria continua selecionável e
    // válida pro product/add_item, só perde o nome bonito na UI.
    return categories
      .map((c) => ({ id: c.category_id, name: c.category_name || `Categoria ${c.category_id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

export const getShopeeLogisticsChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertShopeeOwner, getValidShopeeAccessToken } =
      await import("@/lib/shopee-connection.server");
    const { getLogisticsChannelList } = await import("@/lib/shopee-api.server");

    await assertShopeeOwner(context.userId);
    const { accessToken, shopId } = await getValidShopeeAccessToken();
    const channels = await getLogisticsChannelList(accessToken, shopId);
    return channels.map((c) => ({ id: c.logistics_channel_id, name: c.logistics_channel_name }));
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
};

export const publishShopeeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: PublishInput) => data)
  .handler(async ({ context, data }) => {
    const { assertShopeeOwner, getValidShopeeAccessToken } =
      await import("@/lib/shopee-connection.server");
    const {
      uploadProductImage,
      uploadProductImageFromDataUrl,
      getLogisticsChannelList,
      getBrandList,
      getAttributeTree,
      buildMandatoryAttributeList,
      publishProduct,
    } = await import("@/lib/shopee-api.server");

    await assertShopeeOwner(context.userId);
    const { accessToken, shopId } = await getValidShopeeAccessToken();

    // Confere logística ANTES de subir a imagem — sem canal habilitado o
    // add_item ia falhar de qualquer jeito, sem sentido gastar o upload.
    const channels = await getLogisticsChannelList(accessToken, shopId);
    if (channels.length === 0) {
      throw new Error(
        "Nenhum canal de logística habilitado nessa loja — habilite pelo menos um em Central do Vendedor > Envio antes de publicar.",
      );
    }

    const imageId = data.imageDataUrl
      ? await uploadProductImageFromDataUrl(accessToken, shopId, data.imageDataUrl)
      : await uploadProductImage(accessToken, shopId, data.imageUrl);

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

    // 04/09/2026: descoberto ao vivo — toda categoria da loja sandbox exige
    // um conjunto diferente de atributos obrigatórios (nomes de teste sem
    // sentido, tipo "hello world"). Busca a árvore de atributos da
    // categoria escolhida e resolve automaticamente cada um obrigatório
    // (buildMandatoryAttributeList) — sem isso o add_item quebra em quase
    // toda categoria da sandbox. Falhando a busca, segue sem atributos
    // (categoria pode não exigir nenhum).
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
      imageIds: [imageId],
      logisticIds: channels.map((c) => c.logistics_channel_id),
      brand,
      attributeList,
    });

    const parsed = result as { response?: { item_id?: number } };
    return { itemId: parsed.response?.item_id ?? null };
  });
