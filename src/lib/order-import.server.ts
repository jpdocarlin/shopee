// Server-only: importa as vendas da Shopee e do Mercado Livre da loja do
// cliente (marketplace_orders). Roda no cron (/api/cron/import-orders) e
// quando o cliente abre a tela de Pedidos. Cada venda entra uma vez só
// (UNIQUE marketplace + pedido + item); venda nova manda push pro cliente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMercadoLivreApi } from "@/lib/mercadolivre-api.server";
import { callShopeeApi } from "@/lib/shopee-api.server";

type Channel = "shopee" | "mercado-livre";

export type ImportedSale = {
  marketplace: Channel;
  externalOrderId: string;
  externalItemId: string;
  shipmentId: string | null;
  title: string;
  quantity: number;
  saleCents: number;
  buyerName: string | null;
  channelStatus: string;
  orderedAt: string;
};

const LOOKBACK_DAYS = 3;
const toCents = (reais: number | null | undefined) => Math.round((reais ?? 0) * 100);

// ---------------------------------------------------------------- Shopee

async function fetchShopeeSales(accessToken: string, shopId: number): Promise<ImportedSale[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - LOOKBACK_DAYS * 86400;
  const sns: string[] = [];
  // READY_TO_SHIP = pago e esperando envio (é aí que o pedido ao fornecedor
  // precisa sair). PROCESSED = já organizou o envio no Seller Centre.
  for (const status of ["READY_TO_SHIP", "PROCESSED"]) {
    let cursor = "";
    for (let page = 0; page < 10; page++) {
      const json = await callShopeeApi<{
        response?: {
          order_list?: Array<{ order_sn: string }>;
          more?: boolean;
          next_cursor?: string;
        };
      }>("/api/v2/order/get_order_list", {
        accessToken,
        shopId,
        query: {
          time_range_field: "create_time",
          time_from: from,
          time_to: to,
          page_size: 100,
          order_status: status,
          ...(cursor ? { cursor } : {}),
        },
      });
      sns.push(...(json.response?.order_list ?? []).map((o) => o.order_sn));
      if (!json.response?.more) break;
      cursor = json.response.next_cursor ?? "";
    }
  }

  const out: ImportedSale[] = [];
  for (let i = 0; i < sns.length; i += 50) {
    const json = await callShopeeApi<{
      response?: {
        order_list?: Array<{
          order_sn: string;
          order_status: string;
          create_time: number;
          buyer_username?: string;
          item_list?: Array<{
            item_id: number;
            item_name: string;
            model_quantity_purchased: number;
            model_discounted_price?: number;
            model_original_price?: number;
          }>;
        }>;
      };
    }>("/api/v2/order/get_order_detail", {
      accessToken,
      shopId,
      query: {
        order_sn_list: sns.slice(i, i + 50).join(","),
        response_optional_fields: "item_list,buyer_username",
      },
    });
    for (const o of json.response?.order_list ?? []) {
      for (const it of o.item_list ?? []) {
        const unit = it.model_discounted_price ?? it.model_original_price ?? 0;
        out.push({
          marketplace: "shopee",
          externalOrderId: o.order_sn,
          externalItemId: String(it.item_id),
          shipmentId: null,
          title: it.item_name,
          quantity: it.model_quantity_purchased || 1,
          saleCents: toCents(unit * (it.model_quantity_purchased || 1)),
          buyerName: o.buyer_username ?? null,
          channelStatus: o.order_status,
          orderedAt: new Date(o.create_time * 1000).toISOString(),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------- Mercado Livre

async function fetchMlSales(accessToken: string): Promise<ImportedSale[]> {
  const me = await callMercadoLivreApi<{ id: number }>("/users/me", { accessToken });
  const from = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000).toISOString();
  const json = await callMercadoLivreApi<{
    results?: Array<{
      id: number;
      status: string;
      date_created: string;
      buyer?: { nickname?: string };
      shipping?: { id?: number | null };
      order_items?: Array<{
        item: { id: string; title: string };
        quantity: number;
        unit_price: number;
      }>;
    }>;
  }>("/orders/search", {
    accessToken,
    query: {
      seller: me.id,
      "order.status": "paid",
      "order.date_created.from": from,
      sort: "date_desc",
      limit: 50,
    },
  });
  const out: ImportedSale[] = [];
  for (const o of json.results ?? []) {
    for (const it of o.order_items ?? []) {
      out.push({
        marketplace: "mercado-livre",
        externalOrderId: String(o.id),
        externalItemId: it.item.id,
        shipmentId: o.shipping?.id ? String(o.shipping.id) : null,
        title: it.item.title,
        quantity: it.quantity || 1,
        saleCents: toCents(it.unit_price * (it.quantity || 1)),
        buyerName: o.buyer?.nickname ?? null,
        channelStatus: o.status,
        orderedAt: o.date_created,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------ gravação

async function saveSales(userId: string, sales: ImportedSale[]): Promise<ImportedSale[]> {
  if (sales.length === 0) return [];
  const { findCatalogProductById, findCatalogProductByName } = await import("@/lib/catalog");

  const { data: known } = await supabaseAdmin
    .from("marketplace_orders")
    .select("marketplace, external_order_id, external_item_id")
    .eq("user_id", userId)
    .in(
      "external_order_id",
      sales.map((s) => s.externalOrderId),
    );
  const seen = new Set(
    (known ?? []).map((k) => `${k.marketplace}|${k.external_order_id}|${k.external_item_id}`),
  );
  const fresh = sales.filter(
    (s) => !seen.has(`${s.marketplace}|${s.externalOrderId}|${s.externalItemId}`),
  );
  if (fresh.length === 0) return [];

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("id, marketplace, external_id, product_id, image_url")
    .eq("user_id", userId)
    .in(
      "external_id",
      fresh.map((s) => s.externalItemId),
    );
  const byItem = new Map((listings ?? []).map((l) => [`${l.marketplace}|${l.external_id}`, l]));

  const inserted: ImportedSale[] = [];
  for (const s of fresh) {
    const listing = byItem.get(`${s.marketplace}|${s.externalItemId}`);
    const product =
      findCatalogProductById(listing?.product_id) ??
      (listing ? null : findCatalogProductByName(s.title, 0.8));
    const { error } = await supabaseAdmin.from("marketplace_orders").insert({
      user_id: userId,
      marketplace: s.marketplace,
      external_order_id: s.externalOrderId,
      external_item_id: s.externalItemId,
      shipment_id: s.shipmentId,
      listing_id: listing?.id ?? null,
      product_id: product?.id ?? null,
      product_name: product?.name ?? s.title,
      product_image_url: product?.image ?? listing?.image_url ?? null,
      quantity: s.quantity,
      sale_cents: s.saleCents,
      cost_cents: product ? product.priceCents * s.quantity : null,
      buyer_name: s.buyerName,
      channel_status: s.channelStatus,
      ordered_at: s.orderedAt,
    });
    if (!error) inserted.push(s);
    else if (!/duplicate key/i.test(error.message)) {
      console.error("[order-import] falha ao gravar venda:", error.message);
    }
  }
  return inserted;
}

export async function importOrdersForUser(
  userId: string,
): Promise<{ imported: number; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const all: ImportedSale[] = [];

  try {
    const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
    const { accessToken, shopId } = await getValidShopeeAccessToken(userId);
    all.push(...(await fetchShopeeSales(accessToken, shopId)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/não conectad/i.test(msg)) errors.shopee = msg.slice(0, 200);
  }
  try {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { accessToken } = await getValidMercadoLivreAccessToken(userId);
    all.push(...(await fetchMlSales(accessToken)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/não conectad/i.test(msg)) errors["mercado-livre"] = msg.slice(0, 200);
  }

  const inserted = await saveSales(userId, all);
  if (inserted.length > 0) {
    const { sendToUser } = await import("@/lib/push.server");
    const first = inserted[0];
    const channel = first.marketplace === "shopee" ? "Shopee" : "Mercado Livre";
    await sendToUser(userId, {
      title:
        inserted.length === 1
          ? `💰 Venda nova na ${channel}!`
          : `💰 ${inserted.length} vendas novas!`,
      body:
        inserted.length === 1
          ? `${first.title.slice(0, 70)}. Envie o pedido ao fornecedor em Pedidos.`
          : "Abra Pedidos e envie cada uma ao fornecedor — os dados já estão preenchidos.",
      url: "/pedidos",
      tag: `venda-${first.externalOrderId}`,
    }).catch(() => undefined);
  }
  return { imported: inserted.length, errors };
}

// Cron: todos os clientes com alguma loja conectada.
export async function importOrdersForAll(): Promise<{ users: number; imported: number }> {
  const { data } = await supabaseAdmin
    .from("marketplace_accounts")
    .select("user_id, metadata")
    .eq("status", "active")
    .limit(5000);
  const users = [
    ...new Set(
      (data ?? [])
        .filter((r) => {
          const m = r.metadata as Record<string, unknown> | null;
          return Boolean(m?.shopee_api || m?.mercadolivre_api);
        })
        .map((r) => r.user_id),
    ),
  ];
  let imported = 0;
  for (const userId of users) {
    try {
      imported += (await importOrdersForUser(userId)).imported;
    } catch (err) {
      console.error(`[order-import] ${userId}:`, err);
    }
  }
  return { users: users.length, imported };
}

// Etiqueta do Mercado Livre em PDF (pedido com envio Mercado Envios pronto pra
// despachar). Na Shopee a etiqueta só sai depois de organizar o envio no
// Seller Centre, então lá o cliente baixa e anexa como hoje.
export async function fetchMlLabelPdf(userId: string, shipmentId: string): Promise<string> {
  const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
  const { accessToken } = await getValidMercadoLivreAccessToken(userId);
  const res = await fetch(
    `https://api.mercadolibre.com/shipment_labels?shipment_ids=${encodeURIComponent(shipmentId)}&response_type=pdf`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    if (/not_printable|status/i.test(text)) {
      throw new Error(
        "A etiqueta ainda não está liberada no Mercado Livre. Ela libera quando o envio fica pronto pra despachar — tente de novo em alguns minutos ou baixe pelo app do ML.",
      );
    }
    throw new Error(`Não deu pra baixar a etiqueta do Mercado Livre (erro ${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}
