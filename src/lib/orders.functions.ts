// Vendas importadas da Shopee / Mercado Livre — RPCs da tela de Pedidos.
// SECURITY: tudo exige sessão; cada ação confere que a venda é do usuário.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = /^[0-9a-f-]{36}$/i;

export type ImportedOrder = {
  id: string;
  marketplace: "shopee" | "mercado-livre";
  externalOrderId: string;
  shipmentId: string | null;
  productId: string | null;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  saleCents: number;
  costCents: number | null;
  buyerName: string | null;
  orderedAt: string;
  fulfillmentRequestId: string | null;
};

// Busca vendas novas agora (além do cron) — chamado ao abrir Pedidos.
export const importMyOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { importOrdersForUser } = await import("@/lib/order-import.server");
    return importOrdersForUser(context.userId);
  });

export const listImportedOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportedOrder[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("marketplace_orders")
      .select("*")
      .eq("user_id", context.userId)
      .is("dismissed_at", null)
      .gte("ordered_at", since)
      .order("ordered_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não deu pra carregar as vendas importadas.");
    return (data ?? []).map((r) => ({
      id: r.id,
      marketplace: r.marketplace as ImportedOrder["marketplace"],
      externalOrderId: r.external_order_id,
      shipmentId: r.shipment_id,
      productId: r.product_id,
      productName: r.product_name,
      productImageUrl: r.product_image_url,
      quantity: r.quantity,
      saleCents: r.sale_cents,
      costCents: r.cost_cents,
      buyerName: r.buyer_name,
      orderedAt: r.ordered_at,
      fulfillmentRequestId: r.fulfillment_request_id,
    }));
  });

async function loadOwned(userId: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("marketplace_orders")
    .select("id, user_id, marketplace, shipment_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) throw new Error("Venda não encontrada.");
  return data;
}

// Liga a venda ao pedido enviado ao fornecedor (sai da lista "a enviar").
export const linkImportedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; requestId: string }) => {
    if (!UUID.test(data?.id ?? "") || !UUID.test(data?.requestId ?? "")) {
      throw new Error("Dados inválidos.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    await loadOwned(context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("fulfillment_requests")
      .select("user_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req || req.user_id !== context.userId) throw new Error("Pedido não encontrado.");
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ fulfillment_request_id: data.requestId })
      .eq("id", data.id);
    return { ok: true };
  });

// "Já resolvi por fora" / venda cancelada: some da lista.
export const dismissImportedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!UUID.test(data?.id ?? "")) throw new Error("Venda inválida.");
    return data;
  })
  .handler(async ({ context, data }) => {
    await loadOwned(context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

// Etiqueta do Mercado Livre em PDF (base64) pra anexar sozinha no pedido.
export const getImportedOrderLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!UUID.test(data?.id ?? "")) throw new Error("Venda inválida.");
    return data;
  })
  .handler(async ({ context, data }) => {
    const row = await loadOwned(context.userId, data.id);
    if (row.marketplace !== "mercado-livre" || !row.shipment_id) {
      throw new Error(
        "Na Shopee, baixe a etiqueta no Seller Centre (Organizar envio) e anexe aqui.",
      );
    }
    const { fetchMlLabelPdf } = await import("@/lib/order-import.server");
    return { base64: await fetchMlLabelPdf(context.userId, row.shipment_id) };
  });
