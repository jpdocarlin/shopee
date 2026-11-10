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
// Shopee: "Organizar minha loja" (10/11/2026)
// Monta as categorias da loja a partir da categoria de cada anúncio e
// distribui os produtos nelas. Duas etapas:
//   1. planShopOrganization — só LÊ: devolve a proposta (nada muda na loja);
//   2. applyShopCategoryGroup — cria/usa UMA categoria e põe os produtos nela
//      (o front chama uma vez por categoria, pra mostrar o progresso).
// ---------------------------------------------------------------------------

// 10/11/2026: no 1º teste ao vivo, usar a categoria em que o anúncio ESTÁ
// publicado deu errado — 42 anúncios da loja do Jp estavam publicados em
// "Anéis" (anúncios antigos, feitos fora do Shoppfy). Agora a categoria de
// cada anúncio vem, nesta ordem: (1) do banco conferido, quando é produto do
// catálogo; (2) de uma classificação já guardada pra esse anúncio; (3) da
// sugestão oficial da Shopee pro título, feita na hora e guardada.
// A classificação guardada usa a mesma tabela product_categories, com
// product_id = "listing:<id do anúncio na Shopee>".
const LISTING_PREFIX = "listing:";

let leafPaths: { at: number; paths: Map<number, string> } | null = null;
async function shopeeLeafPaths(
  api: Awaited<ReturnType<typeof shopee>>["api"],
  accessToken: string,
  shopId: number,
): Promise<Map<number, string>> {
  if (leafPaths && Date.now() - leafPaths.at < 60 * 60 * 1000) return leafPaths.paths;
  const all = await api.getCategoryList(accessToken, shopId);
  const byId = new Map(all.map((c) => [c.category_id, c]));
  const paths = new Map<number, string>();
  for (const leaf of all) {
    if (leaf.has_children) continue;
    const parts: string[] = [];
    const seen = new Set<number>();
    let current: (typeof all)[number] | undefined = leaf;
    while (current && !seen.has(current.category_id)) {
      seen.add(current.category_id);
      if (current.display_category_name) parts.unshift(current.display_category_name);
      current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined;
    }
    if (parts.length) paths.set(leaf.category_id, parts.join(" / "));
  }
  leafPaths = { at: Date.now(), paths };
  return paths;
}

export const planShopOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("listings")
      .select("external_id, product_id")
      .eq("user_id", context.userId)
      .eq("marketplace", "shopee")
      .eq("status", "active")
      .limit(1500);
    const listings = (rows ?? []) as Array<{ external_id: string; product_id: string | null }>;
    if (listings.length === 0) {
      throw new Error("Você ainda não tem anúncio ativo na Shopee pra organizar.");
    }

    try {
      // 1ª opção: a categoria conferida do nosso banco (produto do catálogo).
      const verified = new Map<string, string>();
      const productIds = [...new Set(listings.map((l) => l.product_id).filter(Boolean))] as string[];
      for (let i = 0; i < productIds.length; i += 150) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("product_id, category_path")
          .eq("marketplace", "shopee")
          .in("product_id", productIds.slice(i, i + 150));
        for (const row of (data ?? []) as Array<{ product_id: string; category_path: string | null }>) {
          if (row.category_path) verified.set(row.product_id, row.category_path);
        }
      }

      // 2ª opção: classificação já guardada pra esse anúncio.
      const cached = new Map<string, string>();
      const rest = listings.filter((l) => !(l.product_id && verified.has(l.product_id)));
      for (let i = 0; i < rest.length; i += 150) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("product_id, category_path")
          .eq("marketplace", "shopee")
          .in(
            "product_id",
            rest.slice(i, i + 150).map((l) => `${LISTING_PREFIX}${l.external_id}`),
          );
        for (const row of (data ?? []) as Array<{ product_id: string; category_path: string | null }>) {
          if (row.category_path) {
            cached.set(row.product_id.slice(LISTING_PREFIX.length), row.category_path);
          }
        }
      }

      // O que sobrar (pending) o front manda classificar em lotes, pra
      // mostrar o progresso (ver classifyShopeeListings).
      const items: Array<{ externalId: string; path: string }> = [];
      const pending: string[] = [];
      for (const l of listings) {
        const path =
          (l.product_id ? verified.get(l.product_id) : undefined) ?? cached.get(l.external_id);
        if (path) items.push({ externalId: l.external_id, path });
        else pending.push(l.external_id);
      }
      return { total: listings.length, items, pending };
    } catch (err) {
      throw friendly(err, "Não deu pra analisar a loja agora.");
    }
  });

// Classifica um lote de anúncios pela sugestão oficial da Shopee pro título
// (a mesma do Criar Anúncio) e guarda o resultado. Até 24 por chamada.
export const classifyShopeeListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { externalIds: string[] }) => data)
  .handler(async ({ context, data }) => {
    const wanted = (Array.isArray(data.externalIds) ? data.externalIds : [])
      .map((id) => String(id))
      .filter((id) => /^\d{5,20}$/.test(id))
      .slice(0, 24);
    if (wanted.length === 0) return [] as Array<{ externalId: string; path: string | null }>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("listings")
      .select("external_id, title")
      .eq("user_id", context.userId)
      .eq("marketplace", "shopee")
      .in("external_id", wanted);
    const mine = (rows ?? []) as Array<{ external_id: string; title: string | null }>;

    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      const paths = await shopeeLeafPaths(api, accessToken, shopId);
      const results: Array<{ externalId: string; path: string | null; categoryId: number | null }> =
        [];
      let next = 0;
      const worker = async () => {
        while (next < mine.length) {
          const listing = mine[next++];
          let categoryId: number | null = null;
          try {
            const ids = await api.recommendCategory(accessToken, shopId, listing.title ?? "");
            categoryId = ids.find((id) => paths.has(id)) ?? null;
          } catch (err) {
            console.error("[minha-loja] category_recommend falhou:", err);
          }
          results.push({
            externalId: listing.external_id,
            categoryId,
            path: categoryId ? (paths.get(categoryId) ?? null) : null,
          });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

      const toSave = results
        .filter((r) => r.categoryId && r.path)
        .map((r) => ({
          product_id: `${LISTING_PREFIX}${r.externalId}`,
          marketplace: "shopee",
          category_id: String(r.categoryId),
          category_path: r.path,
          product_name: (mine.find((m) => m.external_id === r.externalId)?.title ?? "").slice(0, 300),
          status: "auto",
          source: "organizar",
        }));
      if (toSave.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
          .from("product_categories")
          .upsert(toSave, { onConflict: "product_id,marketplace", ignoreDuplicates: true });
        if (error) console.error("[minha-loja] falha ao guardar classificação:", error.message);
      }
      return results.map((r) => ({ externalId: r.externalId, path: r.path }));
    } catch (err) {
      throw friendly(err, "Não deu pra classificar os anúncios agora.");
    }
  });

export const applyShopCategoryGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; externalIds: string[] }) => data)
  .handler(async ({ context, data }) => {
    const name = clean(data.name, 40);
    if (name.length < 2) throw new Error("Categoria sem nome.");
    const wanted = (Array.isArray(data.externalIds) ? data.externalIds : [])
      .map((id) => String(id))
      .filter((id) => /^\d{5,20}$/.test(id))
      .slice(0, 1500);
    if (wanted.length === 0) return { id: 0, name, added: 0 };

    // Só entram anúncios da Shopee do próprio usuário.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mine = new Set<string>();
    for (let i = 0; i < wanted.length; i += 200) {
      const { data: rows } = await supabaseAdmin
        .from("listings")
        .select("external_id")
        .eq("user_id", context.userId)
        .eq("marketplace", "shopee")
        .in("external_id", wanted.slice(i, i + 200));
      for (const row of (rows ?? []) as Array<{ external_id: string }>) mine.add(row.external_id);
    }
    const itemIds = wanted.filter((id) => mine.has(id)).map(Number);
    if (itemIds.length === 0) throw new Error("Nenhum anúncio válido nessa categoria.");

    try {
      const { api, accessToken, shopId } = await shopee(context.userId);
      // Já existe uma categoria com esse nome? Usa ela.
      const existing = await api.callShopeeApi<{
        response?: {
          shop_categorys?: Array<{ shop_category_id: number; name: string; status: number }>;
        };
      }>("/api/v2/shop_category/get_shop_category_list", {
        accessToken,
        shopId,
        query: { page_size: 100, page_no: 1 },
      });
      const match = (existing.response?.shop_categorys ?? []).find(
        (c) => c.status !== 0 && c.name.trim().toLowerCase() === name.toLowerCase(),
      );
      let id = match?.shop_category_id;
      if (!id) {
        const created = await api.callShopeeApi<{ response?: { shop_category_id?: number } }>(
          "/api/v2/shop_category/add_shop_category",
          { method: "POST", accessToken, shopId, body: { name } },
        );
        id = Number(created.response?.shop_category_id);
      }
      if (!id) throw new Error("A Shopee não devolveu a categoria criada.");

      let added = 0;
      for (let i = 0; i < itemIds.length; i += 100) {
        const batch = itemIds.slice(i, i + 100);
        const res = await api.callShopeeApi<{
          response?: { invalid_item_id_list?: unknown[] };
        }>("/api/v2/shop_category/add_item_list", {
          method: "POST",
          accessToken,
          shopId,
          body: { shop_category_id: id, item_list: batch },
        });
        added += batch.length - (res.response?.invalid_item_id_list?.length ?? 0);
      }

      // Deixa a categoria visível na loja (falhar aqui não desfaz o resto).
      let visible = match?.status === 1;
      if (!visible) {
        try {
          await api.callShopeeApi("/api/v2/shop_category/update_shop_category", {
            method: "POST",
            accessToken,
            shopId,
            body: { shop_category_id: id, status: "NORMAL" },
          });
          visible = true;
        } catch (err) {
          console.error("[minha-loja] não deu pra ativar a categoria:", err);
        }
      }
      return { id, name, added, visible };
    } catch (err) {
      throw friendly(err, `A Shopee não aceitou a categoria “${name}”.`);
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
