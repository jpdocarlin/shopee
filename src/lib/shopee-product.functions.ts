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
    // testando ao vivo). Filtra fora as sem nome em vez de derrubar a lista toda.
    return categories
      .filter((c) => !!c.category_name)
      .map((c) => ({ id: c.category_id, name: c.category_name }))
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
    });

    const parsed = result as { response?: { item_id?: number } };
    return { itemId: parsed.response?.item_id ?? null };
  });
