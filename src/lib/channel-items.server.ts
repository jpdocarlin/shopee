// Server-only: operações nos anúncios JÁ publicados (Shopee e Mercado Livre)
// — ler status/preço, mudar preço, pausar/reativar e listar os anúncios da
// loja. Usado por Meus anúncios, pela pausa automática sem estoque e pela
// revisão de preços. Mesma regra dos outros *.server.ts: só import dinâmico.
import { callMercadoLivreApi } from "@/lib/mercadolivre-api.server";
import { callShopeeApi } from "@/lib/shopee-api.server";

export type Channel = "shopee" | "mercado-livre";
export type ListingStatus = "active" | "paused" | "closed";

export type ChannelItem = {
  externalId: string;
  title: string;
  priceCents: number;
  status: ListingStatus;
  imageUrl: string | null;
  permalink: string | null;
};

const toCents = (reais: number | null | undefined) => Math.round((reais ?? 0) * 100);

// ---------------------------------------------------------------- Shopee

function shopeeStatus(s: string | undefined): ListingStatus {
  if (s === "NORMAL") return "active";
  if (s === "UNLIST") return "paused";
  return "closed"; // BANNED, REVIEWING, SELLER_DELETE, SHOPEE_DELETE
}

function shopeePermalink(shopId: number, itemId: number | string): string {
  return process.env.SHOPEE_ENV === "live"
    ? `https://shopee.com.br/produto-i.${shopId}.${itemId}`
    : `https://seller.sandbox.test-stable.shopee.sg/portal/product/${itemId}`;
}

type ShopeeBase = {
  item_id: number;
  item_name: string;
  item_status: string;
  price_info?: Array<{ current_price?: number; original_price?: number }>;
  image?: { image_url_list?: string[] };
};

export async function shopeeItemsInfo(
  accessToken: string,
  shopId: number,
  itemIds: Array<number | string>,
): Promise<ChannelItem[]> {
  const out: ChannelItem[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const chunk = itemIds.slice(i, i + 50);
    const json = await callShopeeApi<{ response?: { item_list?: ShopeeBase[] } }>(
      "/api/v2/product/get_item_base_info",
      {
        accessToken,
        shopId,
        query: { item_id_list: chunk.join(","), need_tax_info: "false" },
      },
    );
    for (const it of json.response?.item_list ?? []) {
      out.push({
        externalId: String(it.item_id),
        title: it.item_name,
        priceCents: toCents(
          it.price_info?.[0]?.current_price ?? it.price_info?.[0]?.original_price,
        ),
        status: shopeeStatus(it.item_status),
        imageUrl: it.image?.image_url_list?.[0] ?? null,
        permalink: shopeePermalink(shopId, it.item_id),
      });
    }
  }
  return out;
}

export async function shopeeListItemIds(accessToken: string, shopId: number): Promise<number[]> {
  const ids: number[] = [];
  for (const status of ["NORMAL", "UNLIST"]) {
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const json = await callShopeeApi<{
        response?: {
          item?: Array<{ item_id: number }>;
          has_next_page?: boolean;
          next_offset?: number;
        };
      }>("/api/v2/product/get_item_list", {
        accessToken,
        shopId,
        query: { offset, page_size: 100, item_status: status },
      });
      ids.push(...(json.response?.item ?? []).map((i) => i.item_id));
      if (!json.response?.has_next_page) break;
      offset = json.response.next_offset ?? offset + 100;
    }
  }
  return ids;
}

export async function shopeeUpdatePrice(
  accessToken: string,
  shopId: number,
  itemId: string,
  priceCents: number,
): Promise<void> {
  await callShopeeApi("/api/v2/product/update_price", {
    method: "POST",
    accessToken,
    shopId,
    body: {
      item_id: Number(itemId),
      price_list: [{ model_id: 0, original_price: priceCents / 100 }],
    },
  });
}

export async function shopeeSetActive(
  accessToken: string,
  shopId: number,
  itemId: string,
  active: boolean,
): Promise<void> {
  const json = await callShopeeApi<{
    response?: { failure_list?: Array<{ failed_reason?: string }> };
  }>("/api/v2/product/unlist_item", {
    method: "POST",
    accessToken,
    shopId,
    body: { item_list: [{ item_id: Number(itemId), unlist: !active }] },
  });
  const failed = json.response?.failure_list?.[0];
  if (failed)
    throw new Error(
      `[Shopee] não deu pra ${active ? "reativar" : "pausar"}: ${failed.failed_reason ?? "erro"}`,
    );
}

// ---------------------------------------------------------- Mercado Livre

function mlStatus(s: string | undefined): ListingStatus {
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  return "closed"; // closed, under_review, inactive
}

type MlItem = {
  id: string;
  title?: string;
  family_name?: string;
  price?: number;
  status?: string;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
};

export async function mlItemsInfo(accessToken: string, ids: string[]): Promise<ChannelItem[]> {
  const out: ChannelItem[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const json = await callMercadoLivreApi<Array<{ code: number; body: MlItem }>>("/items", {
      accessToken,
      query: {
        ids: chunk.join(","),
        attributes: "id,title,family_name,price,status,permalink,thumbnail,secure_thumbnail",
      },
    });
    for (const r of json) {
      if (r.code !== 200 || !r.body?.id) continue;
      out.push({
        externalId: r.body.id,
        title: r.body.title ?? r.body.family_name ?? r.body.id,
        priceCents: toCents(r.body.price),
        status: mlStatus(r.body.status),
        imageUrl: r.body.secure_thumbnail ?? r.body.thumbnail ?? null,
        permalink: r.body.permalink ?? null,
      });
    }
  }
  return out;
}

export async function mlListItemIds(accessToken: string): Promise<string[]> {
  const me = await callMercadoLivreApi<{ id: number }>("/users/me", { accessToken });
  const ids: string[] = [];
  for (const status of ["active", "paused"]) {
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const json = await callMercadoLivreApi<{ results?: string[]; paging?: { total?: number } }>(
        `/users/${me.id}/items/search`,
        { accessToken, query: { status, offset, limit: 50 } },
      );
      const results = json.results ?? [];
      ids.push(...results);
      offset += results.length;
      if (results.length === 0 || offset >= (json.paging?.total ?? 0)) break;
    }
  }
  return ids;
}

export async function mlUpdatePrice(accessToken: string, itemId: string, priceCents: number) {
  await callMercadoLivreApi(`/items/${itemId}`, {
    method: "PUT",
    accessToken,
    body: { price: priceCents / 100 },
  });
}

export async function mlSetActive(accessToken: string, itemId: string, active: boolean) {
  await callMercadoLivreApi(`/items/${itemId}`, {
    method: "PUT",
    accessToken,
    body: { status: active ? "active" : "paused" },
  });
}

// ----------------------------------------------------------- por usuário

// Abre a conexão certa e devolve as operações já "amarradas" ao token do
// usuário — quem chama não precisa saber qual canal é.
export async function channelOps(userId: string, channel: Channel) {
  if (channel === "shopee") {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const { accessToken, shopId } = await getValidShopeeAccessToken(userId);
    return {
      info: (ids: string[]) => shopeeItemsInfo(accessToken, shopId, ids),
      listIds: async () => (await shopeeListItemIds(accessToken, shopId)).map(String),
      updatePrice: (id: string, cents: number) => shopeeUpdatePrice(accessToken, shopId, id, cents),
      setActive: (id: string, active: boolean) => shopeeSetActive(accessToken, shopId, id, active),
    };
  }
  const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
  const { accessToken } = await getValidMercadoLivreAccessToken(userId);
  return {
    info: (ids: string[]) => mlItemsInfo(accessToken, ids),
    listIds: () => mlListItemIds(accessToken),
    updatePrice: (id: string, cents: number) => mlUpdatePrice(accessToken, id, cents),
    setActive: (id: string, active: boolean) => mlSetActive(accessToken, id, active),
  };
}
