// Server-only: protege os anúncios do cliente quando o catálogo muda.
// - Produto esgotou no fornecedor → pausa os anúncios ativos dele no canal.
// - Produto voltou ao estoque → reativa SÓ os que o sistema pausou.
// - Custo subiu → avisa o dono do anúncio pra revisar o preço (a tela
//   Meus anúncios mostra o preço sugerido pra manter a margem).
// Chamado pelo detector do catálogo (catalog-notify.server.ts) depois de
// cada versão nova do catálogo.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Channel } from "@/lib/channel-items.server";

export const OUT_OF_STOCK_REASON = "Pausado pelo Shoppfy: sem estoque no fornecedor";

type Row = {
  id: string;
  user_id: string;
  marketplace: string;
  external_id: string;
  title: string;
};

async function listingsFor(
  productIds: string[],
  filter: "active" | "system-paused",
): Promise<Row[]> {
  if (productIds.length === 0) return [];
  let q = supabaseAdmin
    .from("listings")
    .select("id, user_id, marketplace, external_id, title")
    .in("product_id", productIds)
    // Só mexe sozinho em anúncio publicado PELO Shoppfy. Anúncio importado da
    // loja pode ser de outro fornecedor com nome parecido.
    .eq("source", "shoppfy");
  q =
    filter === "active"
      ? q.eq("status", "active")
      : q.eq("status", "paused").eq("paused_by_system", true);
  const { data } = await q.limit(2000);
  return (data ?? []) as Row[];
}

async function forEachUser(
  rows: Row[],
  action: (userId: string, channel: Channel, rows: Row[]) => Promise<number>,
): Promise<Map<string, number>> {
  const done = new Map<string, number>();
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.user_id}|${r.marketplace}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, group] of groups) {
    const [userId, channel] = k.split("|") as [string, Channel];
    try {
      const n = await action(userId, channel, group);
      done.set(userId, (done.get(userId) ?? 0) + n);
    } catch (err) {
      // Conexão caída / loja desconectada: segue com os outros clientes.
      console.error(`[protection] ${channel} de ${userId} falhou:`, err);
    }
  }
  return done;
}

export async function protectListings(diff: {
  outOfStockIds: string[];
  backInStockIds: string[];
  priceUpIds: string[];
}): Promise<{ paused: number; reactivated: number; priceAlerts: number }> {
  const { channelOps } = await import("@/lib/channel-items.server");
  const { sendToUser } = await import("@/lib/push.server");
  const now = () => new Date().toISOString();

  // 1) Esgotou → pausa.
  const pausedByUser = await forEachUser(
    await listingsFor(diff.outOfStockIds, "active"),
    async (userId, channel, rows) => {
      const ops = await channelOps(userId, channel);
      let n = 0;
      for (const r of rows) {
        try {
          await ops.setActive(r.external_id, false);
          await supabaseAdmin
            .from("listings")
            .update({
              status: "paused",
              paused_by_system: true,
              pause_reason: OUT_OF_STOCK_REASON,
              updated_at: now(),
            })
            .eq("id", r.id);
          n++;
        } catch (err) {
          console.error(`[protection] não pausou ${r.external_id}:`, err);
        }
      }
      return n;
    },
  );

  // 2) Voltou → reativa só o que o sistema pausou.
  const reactivatedByUser = await forEachUser(
    await listingsFor(diff.backInStockIds, "system-paused"),
    async (userId, channel, rows) => {
      const ops = await channelOps(userId, channel);
      let n = 0;
      for (const r of rows) {
        try {
          await ops.setActive(r.external_id, true);
          await supabaseAdmin
            .from("listings")
            .update({
              status: "active",
              paused_by_system: false,
              pause_reason: null,
              updated_at: now(),
            })
            .eq("id", r.id);
          n++;
        } catch (err) {
          console.error(`[protection] não reativou ${r.external_id}:`, err);
        }
      }
      return n;
    },
  );

  // 3) Custo subiu → aviso pro dono do anúncio (o preço é decisão dele).
  const priceRows = await listingsFor(diff.priceUpIds, "active");
  const priceByUser = new Map<string, number>();
  for (const r of priceRows) priceByUser.set(r.user_id, (priceByUser.get(r.user_id) ?? 0) + 1);

  const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
  for (const [userId, n] of pausedByUser) {
    if (n === 0) continue;
    await sendToUser(userId, {
      title: `⏸️ ${n} ${plural(n, "anúncio pausado", "anúncios pausados")}`,
      body: "O fornecedor ficou sem estoque. Pausamos pra você não vender sem ter o produto — reativamos sozinhos quando voltar.",
      url: "/anuncios",
      tag: "anuncios-pausados",
    }).catch(() => undefined);
  }
  for (const [userId, n] of reactivatedByUser) {
    if (n === 0) continue;
    await sendToUser(userId, {
      title: `▶️ ${n} ${plural(n, "anúncio reativado", "anúncios reativados")}`,
      body: "O produto voltou ao estoque do fornecedor e o anúncio está no ar de novo.",
      url: "/anuncios",
      tag: "anuncios-reativados",
    }).catch(() => undefined);
  }
  for (const [userId, n] of priceByUser) {
    await sendToUser(userId, {
      title: `📈 Revise o preço de ${n} ${plural(n, "anúncio", "anúncios")}`,
      body: "O custo no fornecedor subiu. Em Meus anúncios tem o preço sugerido pra manter o seu lucro.",
      url: "/anuncios",
      tag: "revisao-precos",
    }).catch(() => undefined);
  }

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    paused: sum(pausedByUser),
    reactivated: sum(reactivatedByUser),
    priceAlerts: priceRows.length,
  };
}
