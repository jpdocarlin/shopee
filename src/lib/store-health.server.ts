// Server-only: Saúde da loja — coleta diária dos contadores de cada anúncio
// (visitas e vendas acumuladas, fotos) e montagem do recap semanal.
//
// Shopee e Mercado Livre devolvem visitas/vendas ACUMULADAS do anúncio. Por
// isso guardamos uma "foto" por dia (listing_daily_stats) e a semana é a
// diferença entre o último e o primeiro dia dela.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMercadoLivreApi } from "@/lib/mercadolivre-api.server";
import { callShopeeApi } from "@/lib/shopee-api.server";
import { calcPricing, suggestPrice } from "@/lib/marketplace-fees";

type Channel = "shopee" | "mercado-livre";
const PACKAGING = 200;

// Data no fuso de Brasília (o "dia" do cliente).
export function brDay(d = new Date()): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

type Counter = {
  externalId: string;
  visits: number | null;
  sales: number | null;
  photos: number | null;
};

async function shopeeCounters(userId: string, ids: string[]): Promise<Counter[]> {
  const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
  const { accessToken, shopId } = await getValidShopeeAccessToken(userId);
  const out = new Map<string, Counter>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).join(",");
    const [extra, base] = await Promise.all([
      callShopeeApi<{
        response?: { item_list?: Array<{ item_id: number; sale?: number; views?: number }> };
      }>("/api/v2/product/get_item_extra_info", {
        accessToken,
        shopId,
        query: { item_id_list: chunk },
      }).catch(() => ({ response: { item_list: [] } })),
      callShopeeApi<{
        response?: {
          item_list?: Array<{ item_id: number; image?: { image_url_list?: string[] } }>;
        };
      }>("/api/v2/product/get_item_base_info", {
        accessToken,
        shopId,
        query: { item_id_list: chunk },
      }).catch(() => ({ response: { item_list: [] } })),
    ]);
    for (const it of extra.response?.item_list ?? []) {
      out.set(String(it.item_id), {
        externalId: String(it.item_id),
        visits: typeof it.views === "number" ? it.views : null,
        sales: typeof it.sale === "number" ? it.sale : null,
        photos: null,
      });
    }
    for (const it of base.response?.item_list ?? []) {
      const c = out.get(String(it.item_id)) ?? {
        externalId: String(it.item_id),
        visits: null,
        sales: null,
        photos: null,
      };
      c.photos = it.image?.image_url_list?.length ?? null;
      out.set(c.externalId, c);
    }
  }
  return [...out.values()];
}

async function mlCounters(userId: string, ids: string[]): Promise<Counter[]> {
  const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
  const { accessToken } = await getValidMercadoLivreAccessToken(userId);
  const out = new Map<string, Counter>();
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const [items, visits] = await Promise.all([
      callMercadoLivreApi<
        Array<{ code: number; body: { id: string; sold_quantity?: number; pictures?: unknown[] } }>
      >("/items", {
        accessToken,
        query: { ids: chunk.join(","), attributes: "id,sold_quantity,pictures" },
      }).catch(() => []),
      callMercadoLivreApi<Record<string, number>>("/visits/items", {
        accessToken,
        query: { ids: chunk.join(",") },
      }).catch(() => ({}) as Record<string, number>),
    ]);
    for (const id of chunk)
      out.set(id, { externalId: id, visits: visits[id] ?? null, sales: null, photos: null });
    for (const r of items) {
      if (r.code !== 200) continue;
      const c = out.get(r.body.id);
      if (!c) continue;
      c.sales = r.body.sold_quantity ?? null;
      c.photos = Array.isArray(r.body.pictures) ? r.body.pictures.length : null;
    }
  }
  return [...out.values()];
}

// Foto do dia de todos os anúncios (não encerrados) de um cliente.
export async function collectStatsForUser(userId: string): Promise<number> {
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("id, marketplace, external_id")
    .eq("user_id", userId)
    .neq("status", "closed")
    .limit(2000);
  if (!listings || listings.length === 0) return 0;
  const day = brDay();
  let saved = 0;
  for (const channel of ["shopee", "mercado-livre"] as Channel[]) {
    const rows = listings.filter((l) => l.marketplace === channel);
    if (rows.length === 0) continue;
    let counters: Counter[] = [];
    try {
      counters =
        channel === "shopee"
          ? await shopeeCounters(
              userId,
              rows.map((r) => r.external_id),
            )
          : await mlCounters(
              userId,
              rows.map((r) => r.external_id),
            );
    } catch (err) {
      console.error(
        `[store-health] ${channel} ${userId}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    const byId = new Map(counters.map((c) => [c.externalId, c]));
    const upserts = rows
      .map((r) => {
        const c = byId.get(r.external_id);
        if (!c) return null;
        return {
          listing_id: r.id,
          user_id: userId,
          day,
          total_visits: c.visits,
          total_sales: c.sales,
          photo_count: c.photos,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("listing_daily_stats")
        .upsert(upserts.slice(i, i + 500), { onConflict: "listing_id,day" });
      if (!error) saved += Math.min(500, upserts.length - i);
    }
  }
  return saved;
}

async function usersWithListings(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("user_id")
    .neq("status", "closed")
    .limit(20000);
  return [...new Set((data ?? []).map((r) => r.user_id))];
}

async function inBatches(users: string[], fn: (u: string) => Promise<unknown>) {
  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  for (let i = 0; i < users.length; i += 5) {
    const batch = users.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((u) => withTimeout(fn(u), 45_000)));
    results.forEach((r, k) => {
      if (r.status === "rejected") console.error(`[store-health] ${batch[k]}:`, r.reason);
    });
  }
}

export async function collectStatsForAll(): Promise<{ users: number }> {
  const users = await usersWithListings();
  await inBatches(users, collectStatsForUser);
  return { users: users.length };
}

// ------------------------------------------------------------- análise

export type ListingHealth = {
  listingId: string;
  marketplace: Channel;
  title: string;
  imageUrl: string | null;
  priceCents: number;
  productId: string | null;
  visits: number | null; // no período
  orders: number;
  profitPerSaleCents: number | null;
  photos: number | null;
  diagnosis: "sem-dados" | "poucas-visitas" | "visita-sem-venda" | "vendendo" | "ok";
  tip: string;
};

export type Suggestion = {
  kind: "kit" | "mais-barato" | "outro-canal" | "fotos";
  title: string;
  detail: string;
  productId: string | null;
  marketplace: Channel;
  priceCents?: number;
};

export type ReviewItem = {
  listingId: string;
  title: string;
  imageUrl: string | null;
  reasons: string[];
  severity: number; // maior = mais urgente
};

export type ChannelReport = {
  marketplace: Channel;
  listingsCount: number;
  visits: number | null;
  prevVisits: number | null;
  orders: number;
  prevOrders: number;
  revenueCents: number;
  profitCents: number;
  conversion: number | null;
  topProducts: Array<{ name: string; qty: number; imageUrl: string | null }>;
  review: ReviewItem[]; // só os que precisam de revisão (máx. 30)
  reviewCount: number;
};

export type StoreReport = {
  from: string; // inclusive
  to: string; // inclusive
  visits: number | null;
  prevVisits: number | null;
  orders: number;
  prevOrders: number;
  revenueCents: number;
  profitCents: number;
  conversion: number | null;
  topProducts: Array<{ name: string; qty: number; imageUrl: string | null }>;
  listings: ListingHealth[];
  suggestions: Suggestion[];
  attention: string[];
  channels: ChannelReport[];
};

async function visitsBetween(userId: string, from: string, to: string) {
  // Contador no início (último registro até "from - 1") e no fim (último até "to").
  const { data } = await supabaseAdmin
    .from("listing_daily_stats")
    .select("listing_id, day, total_visits, photo_count")
    .eq("user_id", userId)
    .gte("day", addDays(from, -3))
    .lte("day", to)
    .order("day", { ascending: true })
    .limit(50000);
  const start = new Map<string, number>();
  const end = new Map<string, number>();
  const photos = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.photo_count !== null) photos.set(r.listing_id, r.photo_count);
    if (r.total_visits === null) continue;
    if (r.day < from) start.set(r.listing_id, r.total_visits);
    else {
      if (!start.has(r.listing_id)) start.set(r.listing_id, r.total_visits);
      end.set(r.listing_id, r.total_visits);
    }
  }
  const perListing = new Map<string, number>();
  for (const [id, e] of end) perListing.set(id, Math.max(0, e - (start.get(id) ?? e)));
  // Só dá pra medir a semana com pelo menos 2 fotos do contador (antes e
  // depois); na primeira semana após conectar ainda não há histórico.
  const rows = data ?? [];
  const daysInWindow = new Set(rows.filter((r) => r.day >= from).map((r) => r.day));
  const hasData = end.size > 0 && (rows.some((r) => r.day < from) || daysInWindow.size >= 2);
  return { perListing, photos, hasData };
}

export async function buildStoreReport(
  userId: string,
  from: string,
  to: string,
): Promise<StoreReport> {
  const { findCatalogProductById } = await import("@/lib/catalog");
  const days =
    Math.round(
      (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000,
    ) + 1;
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);

  const [{ data: listings }, cur, prev, { data: orders }, { data: prevOrders }] = await Promise.all(
    [
      supabaseAdmin
        .from("listings")
        .select(
          "id, marketplace, title, image_url, price_cents, product_id, cost_cents, status, paused_by_system",
        )
        .eq("user_id", userId)
        .neq("status", "closed")
        .limit(2000),
      visitsBetween(userId, from, to),
      visitsBetween(userId, prevFrom, prevTo),
      supabaseAdmin
        .from("marketplace_orders")
        .select(
          "listing_id, product_id, product_name, product_image_url, quantity, sale_cents, cost_cents, marketplace, dismissed_at",
        )
        .eq("user_id", userId)
        .gte("ordered_at", `${from}T03:00:00Z`)
        .lt("ordered_at", `${addDays(to, 1)}T03:00:00Z`)
        .limit(5000),
      supabaseAdmin
        .from("marketplace_orders")
        .select("id, dismissed_at, marketplace")
        .eq("user_id", userId)
        .gte("ordered_at", `${prevFrom}T03:00:00Z`)
        .lt("ordered_at", `${from}T03:00:00Z`)
        .limit(5000),
    ],
  );

  const sales = (orders ?? []).filter((o) => !o.dismissed_at);
  const ordersByListing = new Map<string, number>();
  const top = new Map<string, { name: string; qty: number; imageUrl: string | null }>();
  let revenue = 0;
  let profit = 0;
  for (const o of sales) {
    if (o.listing_id)
      ordersByListing.set(o.listing_id, (ordersByListing.get(o.listing_id) ?? 0) + 1);
    const key = o.product_id ?? o.product_name;
    const t = top.get(key) ?? { name: o.product_name, qty: 0, imageUrl: o.product_image_url };
    t.qty += o.quantity;
    top.set(key, t);
    revenue += o.sale_cents;
    const unit = Math.round(o.sale_cents / Math.max(o.quantity, 1));
    const fee = calcPricing(o.marketplace as Channel, 0, unit, 0).feeCents * o.quantity;
    profit += o.sale_cents - fee - (o.cost_cents ?? 0) - PACKAGING * o.quantity;
  }

  const health: ListingHealth[] = (listings ?? []).map((l) => {
    const cost = findCatalogProductById(l.product_id)?.priceCents ?? l.cost_cents;
    const pps =
      cost !== null && cost !== undefined
        ? calcPricing(l.marketplace as Channel, cost, l.price_cents, PACKAGING).profitCents
        : null;
    const visits = cur.hasData ? (cur.perListing.get(l.id) ?? 0) : null;
    const n = ordersByListing.get(l.id) ?? 0;
    let diagnosis: ListingHealth["diagnosis"] = "ok";
    let tip = "Tudo certo por aqui.";
    if (n > 0) {
      diagnosis = "vendendo";
      tip = "Está vendendo. Vale publicar no outro canal e testar um kit.";
    } else if (visits === null) {
      diagnosis = "sem-dados";
      tip = "As visitas começam a ser contadas a partir de agora.";
    } else if (visits < 10 * Math.max(1, days / 7)) {
      diagnosis = "poucas-visitas";
      tip = "Pouca gente está achando. Melhore o título com palavras de busca e a foto de capa.";
    } else {
      diagnosis = "visita-sem-venda";
      tip = "Muita gente vê e ninguém compra: revise o preço, as fotos e a descrição.";
    }
    return {
      listingId: l.id,
      marketplace: l.marketplace as Channel,
      title: l.title,
      imageUrl: l.image_url,
      priceCents: l.price_cents,
      productId: l.product_id,
      visits,
      orders: n,
      profitPerSaleCents: pps,
      photos: cur.photos.get(l.id) ?? null,
      diagnosis,
      tip,
    };
  });

  // Sugestões (regras simples, sempre com números reais).
  const suggestions: Suggestion[] = [];
  const productChannels = new Map<string, Set<string>>();
  for (const l of listings ?? []) {
    if (!l.product_id || l.status !== "active") continue;
    productChannels.set(
      l.product_id,
      (productChannels.get(l.product_id) ?? new Set()).add(l.marketplace),
    );
  }
  for (const h of health) {
    const cost = findCatalogProductById(h.productId)?.priceCents ?? null;
    if (cost === null) continue;
    if (h.orders >= 2 && h.profitPerSaleCents !== null && h.profitPerSaleCents < 500) {
      const kitPrice = suggestPrice(h.marketplace, cost * 2, 0.25, PACKAGING);
      const kitProfit = calcPricing(h.marketplace, cost * 2, kitPrice, PACKAGING).profitCents;
      suggestions.push({
        kind: "kit",
        title: `Kit com 2 unidades: ${h.title.slice(0, 60)}`,
        detail: `Vendeu ${h.orders}x, mas sobra só ${(h.profitPerSaleCents / 100).toFixed(2).replace(".", ",")} por venda. Um kit de 2 por R$ ${(kitPrice / 100).toFixed(2).replace(".", ",")} deixa cerca de R$ ${(kitProfit / 100).toFixed(2).replace(".", ",")} de lucro.`,
        productId: h.productId,
        marketplace: h.marketplace,
        priceCents: kitPrice,
      });
    }
    if (h.diagnosis === "visita-sem-venda" && h.visits !== null && h.visits >= 30) {
      const cheaper = suggestPrice(h.marketplace, cost, 0.15, PACKAGING);
      if (cheaper < h.priceCents) {
        const p = calcPricing(h.marketplace, cost, cheaper, PACKAGING).profitCents;
        suggestions.push({
          kind: "mais-barato",
          title: `Versão mais em conta: ${h.title.slice(0, 60)}`,
          detail: `${h.visits} visitas e nenhuma venda. A R$ ${(cheaper / 100).toFixed(2).replace(".", ",")} ainda sobra R$ ${(p / 100).toFixed(2).replace(".", ",")} por venda.`,
          productId: h.productId,
          marketplace: h.marketplace,
          priceCents: cheaper,
        });
      }
    }
    if (h.orders > 0 && h.productId) {
      const other: Channel = h.marketplace === "shopee" ? "mercado-livre" : "shopee";
      if (!productChannels.get(h.productId)?.has(other)) {
        suggestions.push({
          kind: "outro-canal",
          title: `Publique também no ${other === "shopee" ? "Shopee" : "Mercado Livre"}: ${h.title.slice(0, 50)}`,
          detail: `Vendeu ${h.orders}x no ${h.marketplace === "shopee" ? "Shopee" : "Mercado Livre"} e ainda não está no outro canal.`,
          productId: h.productId,
          marketplace: other,
        });
      }
    }
  }

  const fewPhotos = health.filter((h) => h.photos !== null && h.photos < 3).length;
  const attention: string[] = [];
  if (fewPhotos > 0) attention.push(`${fewPhotos} anúncio(s) com menos de 3 fotos`);
  const noVisits = health.filter((h) => h.diagnosis === "poucas-visitas").length;
  if (noVisits > 0)
    attention.push(`${noVisits} anúncio(s) com poucas visitas — melhore título e foto de capa`);

  const visits = cur.hasData ? [...cur.perListing.values()].reduce((a, b) => a + b, 0) : null;
  const prevVisits = prev.hasData ? [...prev.perListing.values()].reduce((a, b) => a + b, 0) : null;
  const topProducts = [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // ---- por loja (Shopee / Mercado Livre)
  const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]));
  const channels: ChannelReport[] = (["shopee", "mercado-livre"] as Channel[]).map((ch) => {
    const chHealth = health.filter((h) => h.marketplace === ch);
    const ids = new Set(chHealth.map((h) => h.listingId));
    const sumVisits = (m: Map<string, number>) =>
      [...m.entries()].filter(([id]) => ids.has(id)).reduce((a, [, v]) => a + v, 0);
    const chVisits = cur.hasData ? sumVisits(cur.perListing) : null;
    const chSales = sales.filter((o) => o.marketplace === ch);
    let chRevenue = 0;
    let chProfit = 0;
    const chTop = new Map<string, { name: string; qty: number; imageUrl: string | null }>();
    for (const o of chSales) {
      chRevenue += o.sale_cents;
      const unit = Math.round(o.sale_cents / Math.max(o.quantity, 1));
      const fee = calcPricing(ch, 0, unit, 0).feeCents * o.quantity;
      chProfit += o.sale_cents - fee - (o.cost_cents ?? 0) - PACKAGING * o.quantity;
      const key = o.product_id ?? o.product_name;
      const t = chTop.get(key) ?? { name: o.product_name, qty: 0, imageUrl: o.product_image_url };
      t.qty += o.quantity;
      chTop.set(key, t);
    }

    const review: ReviewItem[] = [];
    for (const h of chHealth) {
      const reasons: string[] = [];
      let severity = 0;
      if (listingById.get(h.listingId)?.paused_by_system) {
        reasons.push("Pausado: sem estoque no fornecedor");
        severity = Math.max(severity, 5);
      }
      if (h.profitPerSaleCents !== null && h.profitPerSaleCents < 0) {
        reasons.push(`Prejuízo de ${brl(-h.profitPerSaleCents)} por venda — suba o preço`);
        severity = Math.max(severity, 4);
      } else if (h.profitPerSaleCents !== null && h.profitPerSaleCents < 300) {
        reasons.push(`Lucro baixo: ${brl(h.profitPerSaleCents)} por venda`);
        severity = Math.max(severity, 2);
      }
      if (h.diagnosis === "visita-sem-venda") {
        reasons.push(`${h.visits} visitas e nenhuma venda — revise preço e fotos`);
        severity = Math.max(severity, 3);
      }
      if (h.photos !== null && h.photos < 3) {
        reasons.push(`Só ${h.photos} foto(s) — coloque pelo menos 3`);
        severity = Math.max(severity, 2);
      }
      if (h.diagnosis === "poucas-visitas") {
        reasons.push("Poucas visitas — melhore o título e a foto de capa");
        severity = Math.max(severity, 1);
      }
      if (reasons.length)
        review.push({
          listingId: h.listingId,
          title: h.title,
          imageUrl: h.imageUrl,
          reasons,
          severity,
        });
    }
    review.sort((a, b) => b.severity - a.severity || b.reasons.length - a.reasons.length);

    return {
      marketplace: ch,
      listingsCount: chHealth.length,
      visits: chVisits,
      prevVisits: prev.hasData ? sumVisits(prev.perListing) : null,
      orders: chSales.length,
      prevOrders: (prevOrders ?? []).filter((o) => !o.dismissed_at && o.marketplace === ch).length,
      revenueCents: chRevenue,
      profitCents: chProfit,
      conversion: chVisits && chVisits > 0 ? chSales.length / chVisits : null,
      topProducts: [...chTop.values()].sort((a, b) => b.qty - a.qty).slice(0, 3),
      review: review.slice(0, 30),
      reviewCount: review.length,
    };
  });

  return {
    from,
    to,
    channels,
    visits,
    prevVisits,
    orders: sales.length,
    prevOrders: (prevOrders ?? []).filter((o) => !o.dismissed_at).length,
    revenueCents: revenue,
    profitCents: profit,
    conversion: visits && visits > 0 ? sales.length / visits : null,
    topProducts,
    listings: health,
    suggestions: suggestions.slice(0, 6),
    attention,
  };
}

// --------------------------------------------------------- recap semanal

// Semana anterior completa (segunda a domingo, horário de Brasília).
export function lastWeekRange(now = new Date()): { from: string; to: string } {
  const today = brDay(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const thisMonday = addDays(today, -((dow + 6) % 7));
  return { from: addDays(thisMonday, -7), to: addDays(thisMonday, -1) };
}

export async function sendWeeklyRecap(userId: string): Promise<{ sent: boolean; reason?: string }> {
  const { from, to } = lastWeekRange();
  const { data: existing } = await supabaseAdmin
    .from("weekly_recaps")
    .select("id, sent_at")
    .eq("user_id", userId)
    .eq("week_start", from)
    .maybeSingle();
  if (existing?.sent_at) return { sent: false, reason: "já enviado" };

  const report = await buildStoreReport(userId, from, to);
  if (report.listings.length === 0) return { sent: false, reason: "sem anúncios" };

  const { count } = await supabaseAdmin
    .from("weekly_recaps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const weekNumber = (count ?? 0) + (existing ? 0 : 1);

  await supabaseAdmin.from("weekly_recaps").upsert(
    {
      user_id: userId,
      week_start: from,
      week_number: weekNumber,
      // Histórico enxuto: sem a lista de anúncios (fica pesado e já existe em listings).
      payload: {
        ...report,
        listings: [],
        channels: report.channels.map((c) => ({ ...c, review: [] })),
      } as never,
    },
    { onConflict: "user_id,week_start" },
  );

  const { data: auth } = await supabaseAdmin.auth.admin.getUserById(userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "tudo bem";

  const { sendEmail, weeklyRecapEmail } = await import("@/lib/email.server");
  const email = auth?.user?.email;
  if (email) await sendEmail({ to: email, ...weeklyRecapEmail({ firstName, weekNumber, report }) });

  const { sendToUser } = await import("@/lib/push.server");
  const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  await sendToUser(userId, {
    title: `📊 Semana ${weekNumber} da sua loja`,
    body:
      report.orders > 0
        ? `${report.orders} venda(s), ${brl(report.revenueCents)} vendidos${report.visits !== null ? ` e ${report.visits} visitas` : ""}. Veja o que melhorar.`
        : `${report.visits !== null ? `${report.visits} visitas e ` : ""}nenhuma venda ainda. Veja o que fazer esta semana.`,
    url: "/saude-da-loja",
    tag: `recap-${from}`,
  }).catch(() => undefined);

  await supabaseAdmin
    .from("weekly_recaps")
    .update({ sent_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("week_start", from);
  return { sent: true };
}

export async function sendWeeklyRecapsForAll(): Promise<{ users: number }> {
  const users = await usersWithListings();
  await inBatches(users, sendWeeklyRecap);
  return { users: users.length };
}
