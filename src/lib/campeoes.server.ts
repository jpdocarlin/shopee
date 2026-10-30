// Server-only: "Lista dos Produtos Campeões" (order bump). Os produtos da C7
// que mais venderam entre os lojistas da Shoppfy nos últimos 30 dias (só
// contagem, nunca quem vendeu) + produtos em estoque com lucro bom pra
// completar 50. Preço sugerido e lucro em cada canal. Muda sozinha todo dia.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcPricing, suggestPrice } from "@/lib/marketplace-fees";

const PACKAGING = 200;
const MARGIN = 0.3;

export type Champion = {
  rank: number;
  productId: string;
  name: string;
  image: string;
  category: string;
  costCents: number;
  sold30d: number;
  shopee: { priceCents: number; profitCents: number };
  ml: { priceCents: number; profitCents: number };
  bestChannel: "shopee" | "mercado-livre";
  reason: string;
};

export async function buildChampions(limit = 50): Promise<Champion[]> {
  const { CATALOG } = await import("@/lib/catalog");
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabaseAdmin
    .from("marketplace_orders")
    .select("product_id, quantity, marketplace, dismissed_at")
    .gte("ordered_at", since)
    .not("product_id", "is", null)
    .limit(50000);
  const agg = new Map<string, { qty: number; shopee: number; ml: number }>();
  for (const o of data ?? []) {
    if (o.dismissed_at || !o.product_id) continue;
    const a = agg.get(o.product_id) ?? { qty: 0, shopee: 0, ml: 0 };
    a.qty += o.quantity;
    if (o.marketplace === "shopee") a.shopee += o.quantity;
    else a.ml += o.quantity;
    agg.set(o.product_id, a);
  }

  const inStock = (p: (typeof CATALOG)[number]) => !p.manageStock || p.stock >= 5;
  const priced = (p: (typeof CATALOG)[number]) => {
    const sp = suggestPrice("shopee", p.priceCents, MARGIN, PACKAGING);
    const mp = suggestPrice("mercado-livre", p.priceCents, MARGIN, PACKAGING);
    return {
      shopee: {
        priceCents: sp,
        profitCents: calcPricing("shopee", p.priceCents, sp, PACKAGING).profitCents,
      },
      ml: {
        priceCents: mp,
        profitCents: calcPricing("mercado-livre", p.priceCents, mp, PACKAGING).profitCents,
      },
    };
  };

  const out: Champion[] = [];
  const used = new Set<string>();
  const sold = [...agg.entries()].sort((a, b) => b[1].qty - a[1].qty);
  for (const [id, a] of sold) {
    const p = CATALOG.find((x) => x.id === id);
    if (!p || !inStock(p)) continue;
    const pr = priced(p);
    out.push({
      rank: 0,
      productId: p.id,
      name: p.name,
      image: p.image,
      category: p.category,
      costCents: p.priceCents,
      sold30d: a.qty,
      ...pr,
      bestChannel: a.ml > a.shopee ? "mercado-livre" : "shopee",
      reason: `${a.qty} venda(s) entre os lojistas nos últimos 30 dias`,
    });
    used.add(p.id);
    if (out.length >= limit) break;
  }

  // Completa com produtos em estoque e lucro bom (o motivo diz exatamente isso).
  if (out.length < limit) {
    const extra = CATALOG.filter(
      (p) => !used.has(p.id) && inStock(p) && p.priceCents >= 1500 && p.priceCents <= 25000,
    )
      .map((p) => ({ p, pr: priced(p) }))
      .filter((x) => x.pr.shopee.profitCents >= 800)
      .sort((a, b) => b.pr.shopee.profitCents - a.pr.shopee.profitCents)
      .slice(0, limit - out.length);
    for (const { p, pr } of extra) {
      out.push({
        rank: 0,
        productId: p.id,
        name: p.name,
        image: p.image,
        category: p.category,
        costCents: p.priceCents,
        sold30d: 0,
        ...pr,
        bestChannel: pr.ml.profitCents > pr.shopee.profitCents ? "mercado-livre" : "shopee",
        reason: "Em estoque na C7 e com lucro bom",
      });
    }
  }
  return out.map((c, i) => ({ ...c, rank: i + 1 }));
}
