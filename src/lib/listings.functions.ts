// Meus anúncios — RPCs da tela /anuncios.
// SECURITY: tudo exige sessão (requireSupabaseAuth). Toda ação confere que o
// anúncio é do usuário logado antes de chamar a API do canal.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = /^[0-9a-f-]{36}$/i;

export type MyListing = {
  id: string;
  marketplace: "shopee" | "mercado-livre";
  externalId: string;
  productId: string | null;
  title: string;
  imageUrl: string | null;
  permalink: string | null;
  priceCents: number;
  costCents: number | null;
  status: "active" | "paused" | "closed";
  pausedBySystem: boolean;
  pauseReason: string | null;
  syncedAt: string | null;
  createdAt: string;
};

export const listMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyListing[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Não deu pra carregar seus anúncios agora.");
    return (data ?? []).map((r) => ({
      id: r.id,
      marketplace: r.marketplace as MyListing["marketplace"],
      externalId: r.external_id,
      productId: r.product_id,
      title: r.title,
      imageUrl: r.image_url,
      permalink: r.permalink,
      priceCents: r.price_cents,
      costCents: r.cost_cents,
      status: r.status as MyListing["status"],
      pausedBySystem: r.paused_by_system,
      pauseReason: r.pause_reason,
      syncedAt: r.synced_at,
      createdAt: r.created_at,
    }));
  });

// "Atualizar da loja": busca na Shopee e no ML o status/preço real e importa
// anúncios que ainda não estão na lista. Canal não conectado é pulado.
export const syncMyListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { channelOps } = await import("@/lib/channel-items.server");
    const { syncListingsFromChannel } = await import("@/lib/listings.server");
    const result: Record<string, { imported: number; updated: number } | { error: string }> = {};
    for (const channel of ["shopee", "mercado-livre"] as const) {
      try {
        const ops = await channelOps(context.userId, channel);
        const ids = await ops.listIds();
        const items = await ops.info(ids);
        result[channel] = await syncListingsFromChannel(context.userId, channel, items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result[channel] = {
          error: /não conectad/i.test(msg) ? "não conectada" : msg.slice(0, 200),
        };
      }
    }
    return result;
  });

async function loadOwned(userId: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("listings")
    .select("id, user_id, marketplace, external_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) throw new Error("Anúncio não encontrado.");
  return data;
}

export const updateListingPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; priceCents: number }) => {
    if (!UUID.test(data?.id ?? "")) throw new Error("Anúncio inválido.");
    const cents = Math.round(Number(data?.priceCents));
    if (!Number.isFinite(cents) || cents < 100 || cents > 10_000_000) {
      throw new Error("Preço inválido.");
    }
    return { id: data.id, priceCents: cents };
  })
  .handler(async ({ context, data }) => {
    const row = await loadOwned(context.userId, data.id);
    const { channelOps } = await import("@/lib/channel-items.server");
    const ops = await channelOps(context.userId, row.marketplace as "shopee" | "mercado-livre");
    await ops.updatePrice(row.external_id, data.priceCents);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("listings")
      .update({ price_cents: data.priceCents, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true };
  });

export const setListingActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; active: boolean }) => {
    if (!UUID.test(data?.id ?? "")) throw new Error("Anúncio inválido.");
    return { id: data.id, active: Boolean(data.active) };
  })
  .handler(async ({ context, data }) => {
    const row = await loadOwned(context.userId, data.id);
    const { channelOps } = await import("@/lib/channel-items.server");
    const ops = await channelOps(context.userId, row.marketplace as "shopee" | "mercado-livre");
    await ops.setActive(row.external_id, data.active);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("listings")
      .update({
        status: data.active ? "active" : "paused",
        // Ação manual do cliente: tira a marca de "pausado pelo sistema".
        paused_by_system: false,
        pause_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  });

// Revisão de preços: o custo do fornecedor mudou desde que o anúncio foi
// publicado (ou desde a última revisão). O cliente aplica o preço sugerido
// (muda no canal) ou mantém o preço — nos dois casos o custo novo vira a
// referência e o anúncio sai da lista de revisão.
export const reviewListingCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; newPriceCents?: number | null }) => {
    if (!UUID.test(data?.id ?? "")) throw new Error("Anúncio inválido.");
    const p = data.newPriceCents == null ? null : Math.round(Number(data.newPriceCents));
    if (p !== null && (!Number.isFinite(p) || p < 100 || p > 10_000_000)) {
      throw new Error("Preço inválido.");
    }
    return { id: data.id, newPriceCents: p };
  })
  .handler(async ({ context, data }) => {
    const row = await loadOwned(context.userId, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("listings")
      .select("product_id, cost_cents")
      .eq("id", row.id)
      .single();
    const { findCatalogProductById } = await import("@/lib/catalog");
    const currentCost =
      findCatalogProductById(full?.product_id)?.priceCents ?? full?.cost_cents ?? null;

    if (data.newPriceCents !== null) {
      const { channelOps } = await import("@/lib/channel-items.server");
      const ops = await channelOps(context.userId, row.marketplace as "shopee" | "mercado-livre");
      await ops.updatePrice(row.external_id, data.newPriceCents);
    }
    await supabaseAdmin
      .from("listings")
      .update({
        cost_cents: currentCost,
        ...(data.newPriceCents !== null ? { price_cents: data.newPriceCents } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  });
