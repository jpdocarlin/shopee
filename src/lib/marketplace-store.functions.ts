// Minha Loja (10/11/2026): edição da loja que o usuário JÁ TEM dentro da
// Shopee e do Mercado Livre. Tudo que é salvo aqui vai direto pro
// marketplace pela API oficial — não existe "rascunho" do nosso lado.
//
// O que cada API deixa mexer (conferido na documentação oficial em 10/11/2026):
//   Shopee  — v2.shop.get_profile / update_profile: nome, logo e descrição da
//             loja; v2.shop_category.*: categorias da loja e os produtos de
//             cada uma; v2.product.update_item: título e descrição do anúncio.
//   Mercado Livre — só o anúncio: PUT /items/{id} (título) e
//             PUT /items/{id}/description. A página do vendedor não tem API.
// Banner, cores e layout da vitrine não têm API em nenhum dos dois.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Channel = "shopee" | "mercado-livre";

export type ShopCategory = { id: number; name: string; active: boolean };
export type EditableListing = {
  id: string;
  externalId: string;
  title: string;
  image: string;
  status: string;
};

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Erro da Shopee/ML em português simples (o cru fica só no log).
function friendly(err: unknown, fallback: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  console.error("[minha-loja]", raw);
  if (/não conectada|expirou|shop_no_linked|invalid_token|error_auth/i.test(raw)) {
    return new Error("A conexão com a loja expirou. Reconecte em Integrações e tente de novo.");
  }
  if (/cadastro de vendedor|kyc/i.test(raw)) return new Error(raw);
  const message = raw.match(/"message":"([^"]{3,200})"/)?.[1];
  return new Error(message ? `${fallback} (${message})` : fallback);
}

async function shopee(userId: string) {
  const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
  const api = await import("@/lib/shopee-api.server");
  const { accessToken, shopId } = await getValidShopeeAccessToken(userId);
  return { api, accessToken, shopId };
}

async function ownListing(userId: string, listingId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("listings")
    .select("id, user_id, marketplace, external_id, title")
    .eq("id", listingId)
    .eq("user_id", userId)
    .limit(1);
  const row = data?.[0] as
    | { id: string; marketplace: Channel; external_id: string; title: string | null }
    | undefined;
  if (!row) throw new Error("Anúncio não encontrado na sua conta.");
  return row;
}

// ---------------------------------------------------------------------------
// Visão geral: o que está conectado + perfil e categorias da loja Shopee
// ---------------------------------------------------------------------------

export const getMarketplaceStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getShopeeConnection } = await import("@/lib/shopee-connection.server");
    const { getMercadoLivreConnection } = await import("@/lib/mercadolivre-connection.server");
    const [shopeeConn, mlConn] = await Promise.all([
      getShopeeConnection(context.userId).catch(() => null),
      getMercadoLivreConnection(context.userId).catch(() => null),
    ]);

    let shopeeStore: {
      shopId: number;
      name: string;
      logo: string;
      description: string;
      categories: ShopCategory[];
    } | null = null;
    let shopeeError: string | null = null;

    if (shopeeConn) {
      try {
        const { api, accessToken, shopId } = await shopee(context.userId);
        const [profile, categories] = await Promise.all([
          api.callShopeeApi<{
            response?: { shop_name?: string; shop_logo?: string; description?: string };
          }>("/api/v2/shop/get_profile", { accessToken, shopId }),
          api.callShopeeApi<{
            response?: {
              shop_categorys?: Array<{ shop_category_id: number; name: string; status: number }>;
            };
          }>("/api/v2/shop_category/get_shop_category_list", {
            accessToken,
            shopId,
            query: { page_size: 100, page_no: 1 },
          }),
        ]);
        shopeeStore = {
          shopId,
          name: profile.response?.shop_name ?? "",
          logo: profile.response?.shop_logo ?? "",
          description: profile.response?.description ?? "",
          categories: (categories.response?.shop_categorys ?? [])
            .filter((c) => c.status !== 0)
            .map((c) => ({ id: c.shop_category_id, name: c.name, active: c.status === 1 })),
        };
      } catch (err) {
        shopeeError = friendly(err, "Não deu pra carregar a loja da Shopee agora.").message;
      }
    }

    return {
      shopeeConnected: Boolean(shopeeConn),
      mercadoLivreConnected: Boolean(mlConn),
      shopee: shopeeStore,
      shopeeError,
    };
  });

// ---------------------------------------------------------------------------
// Shopee: perfil da loja (nome, logo, descrição)
// ---------------------------------------------------------------------------

export const updateShopeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name?: string; description?: string; logoDataUrl?: string }) => data)
  .handler(async ({ context, data }) => {
    const body: Record<string, string> = {};
    const name = clean(data.name, 60);
    if (data.name !== undefined) {
      if (name.length < 3) throw new Error("O nome da loja precisa de pelo menos 3 letras.");
      body.shop_name = name;
    }
    if (data.description !== undefined) body.description = clean(data.description, 500);

    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      if (data.logoDataUrl) {
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data.logoDataUrl);
        if (!match) throw new Error("Imagem inválida. Envie PNG, JPG ou WEBP.");
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length > 2 * 1024 * 1024) throw new Error("O logo precisa ter até 2 MB.");
        body.shop_logo = await api.uploadImageForUrl(accessToken, shopId, buffer);
      }
      if (Object.keys(body).length === 0) throw new Error("Nada pra salvar.");
      const result = await api.callShopeeApi<{
        response?: { shop_name?: string; shop_logo?: string; description?: string };
      }>("/api/v2/shop/update_profile", { method: "POST", accessToken, shopId, body });
      return {
        name: result.response?.shop_name ?? body.shop_name ?? null,
        logo: result.response?.shop_logo ?? body.shop_logo ?? null,
        description: result.response?.description ?? body.description ?? null,
      };
    } catch (err) {
      if (err instanceof Error && /^(Imagem inválida|O logo|Nada pra salvar)/.test(err.message)) throw err;
      throw friendly(err, "A Shopee não aceitou a alteração.");
    }
  });

// ---------------------------------------------------------------------------
// Shopee: categorias da loja
// ---------------------------------------------------------------------------

export const saveShopeeShopCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id?: number; name: string }) => data)
  .handler(async ({ context, data }) => {
    const name = clean(data.name, 40);
    if (name.length < 2) throw new Error("Dê um nome pra categoria.");
    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      if (data.id) {
        await api.callShopeeApi("/api/v2/shop_category/update_shop_category", {
          method: "POST",
          accessToken,
          shopId,
          body: { shop_category_id: Number(data.id), name },
        });
        return { id: Number(data.id), name };
      }
      const created = await api.callShopeeApi<{ response?: { shop_category_id?: number } }>(
        "/api/v2/shop_category/add_shop_category",
        { method: "POST", accessToken, shopId, body: { name } },
      );
      return { id: Number(created.response?.shop_category_id), name };
    } catch (err) {
      throw friendly(err, "A Shopee não aceitou a categoria.");
    }
  });

export const deleteShopeeShopCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      await api.callShopeeApi("/api/v2/shop_category/delete_shop_category", {
        method: "POST",
        accessToken,
        shopId,
        body: { shop_category_id: Number(data.id) },
      });
      return { ok: true as const };
    } catch (err) {
      throw friendly(err, "Não deu pra apagar a categoria na Shopee.");
    }
  });

// Ids (da Shopee) dos produtos que estão numa categoria da loja.
export const getShopeeShopCategoryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      const ids: string[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.callShopeeApi<{
          response?: { item_list?: Array<number | { item_id: number }>; more?: boolean };
        }>("/api/v2/shop_category/get_item_list", {
          accessToken,
          shopId,
          query: { shop_category_id: Number(data.id), page_size: 100, page_no: page },
        });
        for (const item of res.response?.item_list ?? []) {
          ids.push(String(typeof item === "number" ? item : item.item_id));
        }
        if (!res.response?.more) break;
      }
      return ids;
    } catch (err) {
      throw friendly(err, "Não deu pra carregar os produtos da categoria.");
    }
  });

export const changeShopeeShopCategoryItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: number; listingIds: string[]; action: "add" | "remove" }) => data)
  .handler(async ({ context, data }) => {
    const listingIds = (Array.isArray(data.listingIds) ? data.listingIds : []).slice(0, 100);
    if (listingIds.length === 0) return { ok: true as const };
    // Só anúncios da Shopee do próprio usuário.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("listings")
      .select("external_id")
      .eq("user_id", context.userId)
      .eq("marketplace", "shopee")
      .in("id", listingIds);
    const itemList = ((rows ?? []) as Array<{ external_id: string }>)
      .map((r) => Number(r.external_id))
      .filter((n) => Number.isFinite(n));
    if (itemList.length === 0) throw new Error("Nenhum anúncio válido selecionado.");
    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      await api.callShopeeApi(
        data.action === "remove"
          ? "/api/v2/shop_category/delete_item_list"
          : "/api/v2/shop_category/add_item_list",
        {
          method: "POST",
          accessToken,
          shopId,
          body: { shop_category_id: Number(data.id), item_list: itemList },
        },
      );
      return { ok: true as const };
    } catch (err) {
      throw friendly(err, "A Shopee não aceitou a alteração na categoria.");
    }
  });

// ---------------------------------------------------------------------------
// Anúncios (Shopee e Mercado Livre): título e descrição
// ---------------------------------------------------------------------------

export const listEditableListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { marketplace: Channel }) => data)
  .handler(async ({ context, data }): Promise<EditableListing[]> => {
    const marketplace: Channel = data.marketplace === "mercado-livre" ? "mercado-livre" : "shopee";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("listings")
      .select("id, external_id, title, image_url, status")
      .eq("user_id", context.userId)
      .eq("marketplace", marketplace)
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1000);
    return (
      (rows ?? []) as Array<{
        id: string;
        external_id: string;
        title: string | null;
        image_url: string | null;
        status: string;
      }>
    ).map((r) => ({
      id: r.id,
      externalId: r.external_id,
      title: r.title ?? "Anúncio",
      image: r.image_url ?? "",
      status: r.status,
    }));
  });

// Título e descrição como estão AGORA no marketplace.
export const getListingContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { listingId: string }) => data)
  .handler(async ({ context, data }) => {
    const listing = await ownListing(context.userId, String(data.listingId));
    try {
      if (listing.marketplace === "shopee") {
        const { api, accessToken, shopId } = await shopee(context.userId);
        const res = await api.callShopeeApi<{
          response?: {
            item_list?: Array<{
              item_name?: string;
              description?: string;
              description_info?: {
                extended_description?: { field_list?: Array<{ field_type?: string; text?: string }> };
              };
            }>;
          };
        }>("/api/v2/product/get_item_base_info", {
          accessToken,
          shopId,
          query: {
            item_id_list: listing.external_id,
            need_tax_info: "false",
            need_complaint_policy: "false",
          },
        });
        const item = res.response?.item_list?.[0];
        const extended = (item?.description_info?.extended_description?.field_list ?? [])
          .filter((f) => f.field_type === "text" && f.text)
          .map((f) => f.text)
          .join("\n");
        return {
          marketplace: "shopee" as const,
          title: item?.item_name ?? listing.title ?? "",
          description: item?.description || extended || "",
          titleLimit: 120,
        };
      }
      const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
      const { callMercadoLivreApi } = await import("@/lib/mercadolivre-api.server");
      const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
      const [item, description] = await Promise.all([
        callMercadoLivreApi<{ title?: string }>(`/items/${listing.external_id}`, { accessToken }),
        callMercadoLivreApi<{ plain_text?: string }>(`/items/${listing.external_id}/description`, {
          accessToken,
        }).catch(() => ({ plain_text: "" })),
      ]);
      return {
        marketplace: "mercado-livre" as const,
        title: item.title ?? listing.title ?? "",
        description: description.plain_text ?? "",
        titleLimit: 60,
      };
    } catch (err) {
      throw friendly(err, "Não deu pra carregar o anúncio agora.");
    }
  });

export const updateListingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { listingId: string; title?: string; description?: string }) => data)
  .handler(async ({ context, data }) => {
    const listing = await ownListing(context.userId, String(data.listingId));
    const isShopee = listing.marketplace === "shopee";
    const title = data.title === undefined ? undefined : clean(data.title, isShopee ? 120 : 60);
    const description =
      data.description === undefined ? undefined : clean(data.description, isShopee ? 3000 : 20000);
    if (title !== undefined && title.length < 10) {
      throw new Error("O título precisa ter pelo menos 10 caracteres.");
    }
    if (description !== undefined && description.length < 20) {
      throw new Error("A descrição precisa ter pelo menos 20 caracteres.");
    }
    if (title === undefined && description === undefined) throw new Error("Nada pra salvar.");

    try {
      if (isShopee) {
        const { api, accessToken, shopId } = await shopee(context.userId);
        await api.callShopeeApi("/api/v2/product/update_item", {
          method: "POST",
          accessToken,
          shopId,
          body: {
            item_id: Number(listing.external_id),
            ...(title !== undefined ? { item_name: title } : {}),
            ...(description !== undefined ? { description } : {}),
          },
        });
      } else {
        const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
        const { callMercadoLivreApi } = await import("@/lib/mercadolivre-api.server");
        const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
        if (description !== undefined) {
          await callMercadoLivreApi(`/items/${listing.external_id}/description`, {
            method: "PUT",
            accessToken,
            body: { plain_text: description },
          });
        }
        if (title !== undefined && title !== (listing.title ?? "")) {
          // Conta no modelo novo usa family_name; no antigo, title.
          try {
            await callMercadoLivreApi(`/items/${listing.external_id}`, {
              method: "PUT",
              accessToken,
              body: { title },
            });
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            if (/sold|vendas|has_bids|not_modifiable|title/i.test(raw)) {
              throw new Error(
                "O Mercado Livre não deixa trocar o título desse anúncio (normalmente porque ele já teve venda). A descrição foi salva.",
              );
            }
            throw err;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && /^O Mercado Livre não deixa/.test(err.message)) throw err;
      throw friendly(err, "O marketplace não aceitou a alteração.");
    }

    if (title !== undefined) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("listings")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", listing.id)
        .eq("user_id", context.userId);
    }
    return { ok: true as const };
  });
