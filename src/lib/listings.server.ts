// Server-only: gravação dos anúncios do cliente (tabela listings).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Channel, ChannelItem } from "@/lib/channel-items.server";

// Nome do anúncio importado precisa bater forte com o do catálogo.
const STRICT_MATCH = 0.8;

// Chamado logo depois de publicar pelo Criar Anúncio. Falha aqui nunca
// derruba a publicação (o anúncio já existe no canal).
export async function recordPublishedListing(input: {
  userId: string;
  marketplace: Channel;
  externalId: string;
  productId: string | null;
  title: string;
  imageUrl: string | null;
  permalink: string | null;
  priceCents: number;
  costCents: number | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("listings").upsert(
    {
      user_id: input.userId,
      marketplace: input.marketplace,
      external_id: input.externalId,
      product_id: input.productId,
      title: input.title,
      image_url: input.imageUrl,
      permalink: input.permalink,
      price_cents: input.priceCents,
      cost_cents: input.costCents,
      status: "active",
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "marketplace,external_id" },
  );
  if (error) console.error("[listings] falha ao gravar anúncio publicado:", error.message);
}

// Sincroniza com o que está de verdade na loja: atualiza status/preço dos que
// já conhecemos e IMPORTA os anúncios que o cliente publicou fora do Shoppfy
// (ou antes de existir Meus anúncios), ligando ao produto do catálogo pelo nome.
export async function syncListingsFromChannel(
  userId: string,
  marketplace: Channel,
  items: ChannelItem[],
): Promise<{ imported: number; updated: number }> {
  if (items.length === 0) return { imported: 0, updated: 0 };
  const { findCatalogProductByName } = await import("@/lib/catalog");

  const { data: existing } = await supabaseAdmin
    .from("listings")
    .select("external_id, user_id, source, product_id")
    .eq("marketplace", marketplace)
    .in(
      "external_id",
      items.map((i) => i.externalId),
    );
  const known = new Map((existing ?? []).map((r) => [r.external_id, r]));

  let imported = 0;
  let updated = 0;
  const now = new Date().toISOString();
  for (const item of items) {
    const row = known.get(item.externalId);
    if (row && row.user_id !== userId) continue; // nunca mexe em anúncio de outra conta
    if (row) {
      // Anúncio importado: refaz a ligação com o catálogo só com nome bem
      // parecido (ligação errada faria pausar ou pedir o produto errado).
      const relink =
        row.source === "imported" ? findCatalogProductByName(item.title, STRICT_MATCH) : undefined;
      await supabaseAdmin
        .from("listings")
        .update({
          title: item.title,
          price_cents: item.priceCents,
          status: item.status,
          image_url: item.imageUrl,
          permalink: item.permalink,
          ...(relink !== undefined
            ? { product_id: relink?.id ?? null, cost_cents: relink?.priceCents ?? null }
            : {}),
          synced_at: now,
          updated_at: now,
        })
        .eq("marketplace", marketplace)
        .eq("external_id", item.externalId);
      updated++;
    } else {
      const product = findCatalogProductByName(item.title, STRICT_MATCH);
      await supabaseAdmin.from("listings").insert({
        user_id: userId,
        marketplace,
        external_id: item.externalId,
        product_id: product?.id ?? null,
        title: item.title,
        image_url: item.imageUrl,
        permalink: item.permalink,
        price_cents: item.priceCents,
        cost_cents: product?.priceCents ?? null,
        status: item.status,
        source: "imported",
        synced_at: now,
      });
      imported++;
    }
  }
  return { imported, updated };
}
