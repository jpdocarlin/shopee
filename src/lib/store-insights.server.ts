// Server-only: Saúde da loja v2 — reputação da conta, nota 0–100, anúncios
// parados, qualidade dos anúncios do Mercado Livre, oportunidades do catálogo
// e tarefas da semana. Tudo vem das APIs oficiais (Shopee account_health,
// Mercado Livre seller_reputation / item performance) ou do nosso banco.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMercadoLivreApi } from "@/lib/mercadolivre-api.server";
import { callShopeeApi } from "@/lib/shopee-api.server";
import { calcPricing, suggestPrice } from "@/lib/marketplace-fees";
import { brDay, buildStoreReport } from "@/lib/store-health.server";

type Channel = "shopee" | "mercado-livre";
const PACKAGING = 200;
const addDays = (day: string, n: number) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// ------------------------------------------------------------ reputação

export type ReputationMetric = {
  name: string;
  value: string; // já formatado (ex.: "2,1%")
  target: string | null; // ex.: "até 3%"
  ok: boolean | null;
};

export type Reputation = {
  marketplace: Channel;
  available: boolean;
  unavailableReason?: string;
  label: string; // "Excelente", "Verde", ...
  tone: "good" | "warn" | "bad" | "neutral";
  penaltyPoints?: number;
  punishments?: string[];
  metrics: ReputationMetric[];
  issuesCount?: number; // anúncios com problema apontados pela Shopee
};

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

const SHOPEE_PUNISHMENT: Record<number, string> = {
  103: "Anúncios fora das categorias",
  104: "Anúncios fora da busca",
  105: "Não pode criar anúncios",
  106: "Não pode editar anúncios",
  107: "Fora das campanhas de marketing",
  109: "Conta suspensa",
  2008: "Limite de pedidos aplicado",
};

async function shopeeReputation(userId: string): Promise<Reputation> {
  const base: Reputation = {
    marketplace: "shopee",
    available: false,
    label: "—",
    tone: "neutral",
    metrics: [],
  };
  const { getShopeeConnection, getValidShopeeAccessToken } =
    await import("@/lib/shopee-connection.server");
  if (!(await getShopeeConnection(userId).catch(() => null))) return base;
  const { accessToken, shopId } = await getValidShopeeAccessToken(userId);
  const call = <T>(path: string, query?: Record<string, string | number>) =>
    callShopeeApi<T & { error?: string; message?: string }>(path, { accessToken, shopId, query });

  type Perf = {
    response?: {
      overall_performance?: { rating?: number };
      metric_list?: Array<{
        metric_id: number;
        metric_name?: string;
        current_period?: number | null;
        unit?: number;
        target?: { value?: number; comparator?: string };
      }>;
    };
  };
  const [perf, penalty, punish, issues] = await Promise.all([
    call<Perf>("/api/v2/account_health/get_shop_performance").catch((e: unknown) => ({
      error: e instanceof Error ? e.message : "erro",
    })) as Promise<Perf & { error?: string }>,
    call<{ response?: { penalty_point_list?: Array<{ latest_point_num?: number }> } }>(
      "/api/v2/account_health/get_penalty_point_history",
      { page_no: 1, page_size: 100 },
    ).catch(() => null),
    call<{ response?: { punishment_list?: Array<{ punishment_type?: number }> } }>(
      "/api/v2/account_health/get_punishment_history",
      { punishment_status: 1, page_no: 1, page_size: 50 },
    ).catch(() => null),
    call<{ response?: { total_count?: number } }>(
      "/api/v2/account_health/get_listings_with_issues",
      { page_no: 1, page_size: 1 },
    ).catch(() => null),
  ]);

  if (!perf?.response) {
    return {
      ...base,
      unavailableReason:
        "A Shopee não liberou a saúde da conta pra Shoppfy. Reconecte a loja em Integrações pra dar a permissão.",
    };
  }
  const rating = perf.response.overall_performance?.rating ?? 0;
  const RATING: Record<number, [string, Reputation["tone"]]> = {
    4: ["Excelente", "good"],
    3: ["Boa", "good"],
    2: ["Precisa melhorar", "warn"],
    1: ["Ruim", "bad"],
  };
  const [label, tone] = RATING[rating] ?? ["Sem avaliação", "neutral"];
  const WANTED: Record<number, string> = {
    1: "Atraso no envio",
    3: "Pedidos não enviados",
    42: "Cancelamentos",
    43: "Devoluções e reembolsos",
    11: "Resposta no chat",
    22: "Nota da loja",
  };
  const metrics: ReputationMetric[] = [];
  for (const m of perf.response.metric_list ?? []) {
    const name = WANTED[m.metric_id];
    if (!name || m.current_period === null || m.current_period === undefined) continue;
    const isPct = m.unit === 2;
    const fmt = (v: number) => (isPct ? pct(v) : String(v));
    const t = m.target;
    let ok: boolean | null = null;
    if (t?.value !== undefined && t.comparator) {
      const v = m.current_period;
      ok =
        t.comparator === "<"
          ? v < t.value
          : t.comparator === "<="
            ? v <= t.value
            : t.comparator === ">"
              ? v > t.value
              : t.comparator === ">="
                ? v >= t.value
                : null;
    }
    metrics.push({
      name,
      value: fmt(m.current_period),
      target: t?.value !== undefined ? `meta ${t.comparator ?? ""} ${fmt(t.value)}`.trim() : null,
      ok,
    });
  }
  const penaltyPoints = (penalty?.response?.penalty_point_list ?? []).reduce(
    (a, p) => a + (p.latest_point_num ?? 0),
    0,
  );
  const punishments = (punish?.response?.punishment_list ?? []).map(
    (p) => SHOPEE_PUNISHMENT[p.punishment_type ?? 0] ?? "Restrição ativa na conta",
  );
  return {
    marketplace: "shopee",
    available: true,
    label,
    tone: punishments.length ? "bad" : tone,
    penaltyPoints,
    punishments: [...new Set(punishments)],
    metrics,
    issuesCount: issues?.response?.total_count ?? undefined,
  };
}

const ML_LEVEL: Record<string, [string, Reputation["tone"]]> = {
  "5_green": ["Verde", "good"],
  "4_light_green": ["Verde-claro", "good"],
  "3_yellow": ["Amarelo", "warn"],
  "2_orange": ["Laranja", "bad"],
  "1_red": ["Vermelho", "bad"],
};

async function mlReputation(userId: string): Promise<Reputation> {
  const base: Reputation = {
    marketplace: "mercado-livre",
    available: false,
    label: "—",
    tone: "neutral",
    metrics: [],
  };
  const { getMercadoLivreConnection, getValidMercadoLivreAccessToken } =
    await import("@/lib/mercadolivre-connection.server");
  const conn = await getMercadoLivreConnection(userId).catch(() => null);
  if (!conn?.user_id) return base;
  const { accessToken } = await getValidMercadoLivreAccessToken(userId);
  type Rate = { rate?: number; value?: number };
  const me = await callMercadoLivreApi<{
    seller_reputation?: {
      level_id?: string | null;
      power_seller_status?: string | null;
      transactions?: { total?: number };
      metrics?: {
        claims?: Rate;
        delayed_handling_time?: Rate;
        cancellations?: Rate;
        sales?: { completed?: number };
      };
    };
  }>(`/users/${conn.user_id}`, { accessToken }).catch(() => null);
  const rep = me?.seller_reputation;
  if (!rep) return { ...base, unavailableReason: "Não deu pra ler a reputação agora." };
  const [label, tone] = rep.level_id
    ? (ML_LEVEL[rep.level_id] ?? ["—", "neutral"])
    : (["Sem termômetro ainda (poucas vendas)", "neutral"] as [string, Reputation["tone"]]);
  // Limites do Mercado Livre Brasil pra ficar no verde.
  const m = rep.metrics ?? {};
  const metric = (name: string, r: Rate | undefined, limit: number): ReputationMetric | null =>
    r?.rate === undefined
      ? null
      : {
          name,
          value: pct(r.rate * 100),
          target: `verde até ${pct(limit)}`,
          ok: r.rate * 100 <= limit,
        };
  // Sem termômetro (poucas vendas), o Mercado Livre ainda não aplica as
  // taxas na reputação — mostra os números, mas não marca como fora da meta.
  const counts = !!rep.level_id;
  const metrics = [
    metric("Reclamações", m.claims, 1),
    metric("Atraso no envio", m.delayed_handling_time, 6),
    metric("Cancelamentos", m.cancellations, 0.5),
  ]
    .filter((x): x is ReputationMetric => x !== null)
    .map((x) => (counts ? x : { ...x, ok: null, target: "ainda não conta (poucas vendas)" }));
  const medal: Record<string, string> = {
    silver: "MercadoLíder",
    gold: "MercadoLíder Gold",
    platinum: "MercadoLíder Platinum",
  };
  return {
    marketplace: "mercado-livre",
    available: true,
    label: rep.power_seller_status
      ? `${label} · ${medal[rep.power_seller_status] ?? rep.power_seller_status}`
      : label,
    tone,
    metrics,
  };
}

// ------------------------------------------------ qualidade dos anúncios ML

export type MlQuality = {
  listingId: string;
  title: string;
  imageUrl: string | null;
  score: number | null;
  level: string | null;
  actions: string[];
};

type PerfRule = { status?: string; wordings?: { title?: string; label?: string } };
type PerfVar = { status?: string; title?: string; rules?: PerfRule[] };
type PerfBucket = { status?: string; title?: string; variables?: PerfVar[]; rules?: PerfRule[] };

async function mlQuality(
  userId: string,
  listings: Array<{ id: string; external_id: string; title: string; image_url: string | null }>,
): Promise<MlQuality[]> {
  if (listings.length === 0) return [];
  const { getValidMercadoLivreAccessToken } = await import("@/lib/mercadolivre-connection.server");
  const { accessToken } = await getValidMercadoLivreAccessToken(userId);
  const out: MlQuality[] = [];
  for (let i = 0; i < listings.length; i += 5) {
    const chunk = listings.slice(i, i + 5);
    const res = await Promise.all(
      chunk.map((l) =>
        callMercadoLivreApi<{ score?: number; level?: string; buckets?: PerfBucket[] }>(
          `/item/${l.external_id}/performance`,
          { accessToken },
        ).catch(() => null),
      ),
    );
    res.forEach((r, k) => {
      const l = chunk[k];
      const actions: string[] = [];
      const pending = (s?: string) => !!s && !/complete|done|ok/i.test(s);
      for (const b of r?.buckets ?? []) {
        for (const v of b.variables ?? []) {
          for (const rule of v.rules ?? []) {
            if (pending(rule.status)) actions.push(rule.wordings?.title ?? v.title ?? "");
          }
          if (!v.rules?.length && pending(v.status) && v.title) actions.push(v.title);
        }
        for (const rule of b.rules ?? [])
          if (pending(rule.status)) actions.push(rule.wordings?.title ?? b.title ?? "");
      }
      out.push({
        listingId: l.id,
        title: l.title,
        imageUrl: l.image_url,
        score: typeof r?.score === "number" ? r.score : null,
        level: r?.level ?? null,
        actions: [...new Set(actions.filter(Boolean))].slice(0, 4),
      });
    });
  }
  return out.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
}

// ------------------------------------------------------- anúncios parados

export type StaleListing = {
  listingId: string;
  marketplace: Channel;
  title: string;
  imageUrl: string | null;
  days: number;
};

async function staleListings(
  userId: string,
  listings: Array<{
    id: string;
    marketplace: string;
    external_id: string;
    title: string;
    image_url: string | null;
    status: string;
  }>,
): Promise<{ items: StaleListing[]; shopeeReady: boolean }> {
  const today = brDay();
  const from = addDays(today, -30);
  const active = listings.filter((l) => l.status === "active");
  const items: StaleListing[] = [];

  // Shopee: precisa de pelo menos 14 dias de fotos diárias dos contadores.
  const shopee = active.filter((l) => l.marketplace === "shopee");
  let shopeeReady = false;
  if (shopee.length) {
    const { data } = await supabaseAdmin
      .from("listing_daily_stats")
      .select("listing_id, day, total_visits")
      .eq("user_id", userId)
      .gte("day", from)
      .order("day", { ascending: true })
      .limit(50000);
    const rows = data ?? [];
    const days = [...new Set(rows.map((r) => r.day))];
    shopeeReady = days.length >= 2 && days[0] <= addDays(today, -14);
    if (shopeeReady) {
      const first = new Map<string, number>();
      const last = new Map<string, number>();
      for (const r of rows) {
        if (r.total_visits === null) continue;
        if (!first.has(r.listing_id)) first.set(r.listing_id, r.total_visits);
        last.set(r.listing_id, r.total_visits);
      }
      const span = Math.round(
        (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${days[0]}T12:00:00Z`).getTime()) /
          86400000,
      );
      for (const l of shopee) {
        const a = first.get(l.id);
        const b = last.get(l.id);
        if (a !== undefined && b !== undefined && b - a === 0)
          items.push({
            listingId: l.id,
            marketplace: "shopee",
            title: l.title,
            imageUrl: l.image_url,
            days: span,
          });
      }
    }
  }

  // Mercado Livre: a API devolve as visitas de cada anúncio nos últimos 30 dias.
  const ml = active.filter((l) => l.marketplace === "mercado-livre").slice(0, 60);
  if (ml.length) {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { accessToken } = await getValidMercadoLivreAccessToken(userId).catch(() => ({
      accessToken: "",
    }));
    if (accessToken) {
      for (const l of ml) {
        const r = await callMercadoLivreApi<Array<{ item_id: string; total_visits?: number }>>(
          "/items/visits",
          { accessToken, query: { ids: l.external_id, date_from: from, date_to: today } },
        ).catch(() => null);
        const total = Array.isArray(r) ? r[0]?.total_visits : undefined;
        if (total === 0)
          items.push({
            listingId: l.id,
            marketplace: "mercado-livre",
            title: l.title,
            imageUrl: l.image_url,
            days: 30,
          });
      }
    }
  }
  return { items, shopeeReady };
}

// -------------------------------------------------- oportunidades catálogo

export type Opportunity = {
  productId: string;
  name: string;
  image: string;
  costCents: number;
  soldQty: number;
  sellers: number;
  suggestedShopeeCents: number;
  profitShopeeCents: number;
};

async function opportunities(userId: string, ownProductIds: Set<string>): Promise<Opportunity[]> {
  const { findCatalogProductById } = await import("@/lib/catalog");
  const since = `${addDays(brDay(), -30)}T03:00:00Z`;
  // Só contagem agregada — nunca expõe quem vendeu.
  const { data } = await supabaseAdmin
    .from("marketplace_orders")
    .select("product_id, quantity, user_id, dismissed_at")
    .gte("ordered_at", since)
    .not("product_id", "is", null)
    .limit(20000);
  const agg = new Map<string, { qty: number; sellers: Set<string> }>();
  for (const o of data ?? []) {
    if (o.dismissed_at || !o.product_id) continue;
    const a = agg.get(o.product_id) ?? { qty: 0, sellers: new Set<string>() };
    a.qty += o.quantity;
    a.sellers.add(o.user_id);
    agg.set(o.product_id, a);
  }
  const out: Opportunity[] = [];
  for (const [productId, a] of agg) {
    if (ownProductIds.has(productId)) continue;
    const p = findCatalogProductById(productId);
    if (!p || (p.manageStock && p.stock <= 0)) continue;
    const price = suggestPrice("shopee", p.priceCents, 0.25, PACKAGING);
    out.push({
      productId,
      name: p.name,
      image: p.image,
      costCents: p.priceCents,
      soldQty: a.qty,
      sellers: a.sellers.size,
      suggestedShopeeCents: price,
      profitShopeeCents: calcPricing("shopee", p.priceCents, price, PACKAGING).profitCents,
    });
  }
  void userId;
  return out.sort((x, y) => y.soldQty - x.soldQty).slice(0, 6);
}

// ------------------------------------------------------------- nota 0–100

export type StoreScore = {
  marketplace: Channel;
  score: number;
  drags: Array<{ label: string; points: number }>;
};

function scoreFor(
  ch: Channel,
  rep: Reputation | undefined,
  listings: Array<{ marketplace: string }>,
  review: { fewPhotos: number; loss: number },
  staleCount: number,
  quality: MlQuality[],
): StoreScore {
  const total = listings.filter((l) => l.marketplace === ch).length || 1;
  const drags: StoreScore["drags"] = [];
  if (rep?.available) {
    if (rep.tone === "bad") drags.push({ label: `Reputação: ${rep.label}`, points: 30 });
    else if (rep.tone === "warn") drags.push({ label: `Reputação: ${rep.label}`, points: 15 });
    if (rep.penaltyPoints)
      drags.push({
        label: `${rep.penaltyPoints} ponto(s) de penalidade`,
        points: Math.min(15, rep.penaltyPoints * 3),
      });
    if (rep.punishments?.length)
      drags.push({ label: `Restrição ativa: ${rep.punishments[0]}`, points: 15 });
    const failed = rep.metrics.filter((m) => m.ok === false);
    if (failed.length)
      drags.push({
        label: `Fora da meta: ${failed.map((m) => m.name.toLowerCase()).join(", ")}`,
        points: Math.min(15, failed.length * 5),
      });
  }
  if (review.loss)
    drags.push({
      label: `${review.loss} anúncio(s) dando prejuízo`,
      points: Math.max(2, Math.round((review.loss / total) * 20)),
    });
  if (review.fewPhotos)
    drags.push({
      label: `${review.fewPhotos} anúncio(s) com menos de 3 fotos`,
      points: Math.max(2, Math.round((review.fewPhotos / total) * 15)),
    });
  if (staleCount)
    drags.push({
      label: `${staleCount} anúncio(s) parados (sem visita)`,
      points: Math.max(2, Math.round((staleCount / total) * 15)),
    });
  const scored = quality.filter((q) => q.score !== null);
  if (ch === "mercado-livre" && scored.length) {
    const avg = scored.reduce((a, q) => a + (q.score ?? 0), 0) / scored.length;
    if (avg < 90)
      drags.push({
        label: `Qualidade média dos anúncios: ${Math.round(avg)}/100`,
        points: Math.round((100 - avg) / 10),
      });
  }
  drags.sort((a, b) => b.points - a.points);
  const score = Math.max(0, 100 - drags.reduce((a, d) => a + d.points, 0));
  return { marketplace: ch, score, drags };
}

// ------------------------------------------------------- tarefas da semana

export type WeeklyTask = {
  id: string;
  key: string;
  title: string;
  detail: string | null;
  link: string | null;
  done: boolean;
};

export function mondayOf(day = brDay()): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  return addDays(day, -dow);
}

type TaskDraft = { key: string; title: string; detail: string; link: string };

async function ensureWeeklyTasks(userId: string, drafts: TaskDraft[]): Promise<WeeklyTask[]> {
  const week = mondayOf();
  const table = () => supabaseAdmin.from("weekly_tasks" as never);
  const { data: existing } = await table()
    .select("id, task_key, title, detail, link, done_at")
    .eq("user_id", userId)
    .eq("week_start", week)
    .order("created_at", { ascending: true });
  let rows = (existing ?? []) as Array<{
    id: string;
    task_key: string;
    title: string;
    detail: string | null;
    link: string | null;
    done_at: string | null;
  }>;
  // Gera uma vez por semana. Enquanto nenhuma foi marcada como feita, a lista
  // acompanha o estado atual (ex.: um problema que já foi resolvido sai).
  const wanted = drafts.slice(0, 5).map((d) => d.key);
  const stale =
    rows.length > 0 &&
    rows.every((r) => !r.done_at) &&
    rows.map((r) => r.task_key).join("|") !== wanted.join("|");
  if (stale) {
    await table().delete().eq("user_id", userId).eq("week_start", week).is("done_at", null);
    rows = [];
  }
  if (rows.length === 0 && drafts.length) {
    const { data: inserted } = await table()
      .insert(
        drafts.slice(0, 5).map((d) => ({
          user_id: userId,
          week_start: week,
          task_key: d.key,
          title: d.title,
          detail: d.detail,
          link: d.link,
        })) as never,
      )
      .select("id, task_key, title, detail, link, done_at");
    rows = (inserted ?? []) as typeof rows;
  }
  return rows.map((r) => ({
    id: r.id,
    key: r.task_key,
    title: r.title,
    detail: r.detail,
    link: r.link,
    done: !!r.done_at,
  }));
}

export async function setWeeklyTaskDone(userId: string, id: string, done: boolean) {
  const { error } = await supabaseAdmin
    .from("weekly_tasks" as never)
    .update({ done_at: done ? new Date().toISOString() : null } as never)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// ------------------------------------------------------------- tudo junto

export type StoreInsights = {
  connected: Channel[];
  reputation: Reputation[];
  scores: StoreScore[];
  stale: StaleListing[];
  shopeeStaleReady: boolean;
  mlQuality: MlQuality[];
  opportunities: Opportunity[];
  tasks: WeeklyTask[];
  weekStart: string;
};

export async function buildStoreInsights(
  userId: string,
  connected: Channel[],
): Promise<StoreInsights> {
  const { data: listingsData } = await supabaseAdmin
    .from("listings")
    .select("id, marketplace, external_id, title, image_url, status, product_id")
    .eq("user_id", userId)
    .neq("status", "closed")
    .limit(2000);
  const listings = listingsData ?? [];
  const today = brDay();

  const safe = <T>(p: Promise<T>, fallback: T) =>
    p.catch((err) => {
      console.error("[store-insights]", err instanceof Error ? err.message : err);
      return fallback;
    });
  const mlListings = listings.filter((l) => l.marketplace === "mercado-livre").slice(0, 40);

  const [shRep, mlRep, quality, stale, opps, report] = await Promise.all([
    connected.includes("shopee") ? safe(shopeeReputation(userId), null) : Promise.resolve(null),
    connected.includes("mercado-livre") ? safe(mlReputation(userId), null) : Promise.resolve(null),
    connected.includes("mercado-livre")
      ? safe(mlQuality(userId, mlListings), [] as MlQuality[])
      : Promise.resolve([] as MlQuality[]),
    safe(staleListings(userId, listings), { items: [] as StaleListing[], shopeeReady: false }),
    safe(
      opportunities(
        userId,
        new Set(listings.map((l) => l.product_id).filter((x): x is string => !!x)),
      ),
      [] as Opportunity[],
    ),
    buildStoreReport(userId, addDays(today, -29), today),
  ]);

  const reputation = [shRep, mlRep].filter((r): r is Reputation => r !== null);

  const scores = connected.map((ch) => {
    const chHealth = report.listings.filter((h) => h.marketplace === ch);
    return scoreFor(
      ch,
      reputation.find((r) => r.marketplace === ch),
      listings,
      {
        fewPhotos: chHealth.filter((h) => h.photos !== null && h.photos < 3).length,
        loss: chHealth.filter((h) => h.profitPerSaleCents !== null && h.profitPerSaleCents < 0)
          .length,
      },
      stale.items.filter((s) => s.marketplace === ch).length,
      quality,
    );
  });

  // Tarefas: as ações mais importantes da semana, na ordem de impacto.
  const drafts: TaskDraft[] = [];
  const naLoja = (ch: Channel) => (ch === "shopee" ? "na Shopee" : "no Mercado Livre");
  for (const r of reputation) {
    if (r.punishments?.length)
      drafts.push({
        key: `punicao-${r.marketplace}`,
        title: `Resolver a restrição ${naLoja(r.marketplace)}: ${r.punishments[0]}`,
        detail:
          "Veja o motivo na saúde da conta da Central do Vendedor e corrija o que foi apontado.",
        link: "/saude-da-loja",
      });
    for (const m of r.metrics.filter((x) => x.ok === false))
      drafts.push({
        key: `metrica-${r.marketplace}-${m.name}`,
        title: `Melhorar "${m.name.toLowerCase()}" ${naLoja(r.marketplace)} (${m.value})`,
        detail: m.target ? `Hoje está em ${m.value}; ${m.target}.` : `Hoje está em ${m.value}.`,
        link: "/pedidos",
      });
  }
  for (const ch of connected) {
    const chHealth = report.listings.filter((h) => h.marketplace === ch);
    const loss = chHealth.filter(
      (h) => h.profitPerSaleCents !== null && h.profitPerSaleCents < 0,
    ).length;
    if (loss)
      drafts.push({
        key: `prejuizo-${ch}`,
        title: `Corrigir o preço de ${loss} anúncio(s) com prejuízo ${naLoja(ch)}`,
        detail: "Em Meus anúncios, ajuste o preço pra voltar a ter lucro.",
        link: "/anuncios",
      });
  }
  const lowQuality = quality.filter((q) => q.score !== null && (q.score ?? 100) < 70);
  if (lowQuality.length)
    drafts.push({
      key: "qualidade-ml",
      title: `Completar ${lowQuality.length} anúncio(s) do Mercado Livre com qualidade baixa`,
      detail: lowQuality[0].actions[0] ?? "Ficha técnica, fotos e descrição.",
      link: "/saude-da-loja",
    });
  for (const ch of connected) {
    const few = report.listings.filter(
      (h) => h.marketplace === ch && h.photos !== null && h.photos < 3,
    ).length;
    if (few)
      drafts.push({
        key: `fotos-${ch}`,
        title: `Colocar pelo menos 3 fotos em ${few} anúncio(s) ${naLoja(ch)}`,
        detail: "Anúncio com mais fotos aparece mais e converte melhor.",
        link: "/anuncios",
      });
  }
  if (stale.items.length)
    drafts.push({
      key: "parados",
      title: `Refazer título e foto de capa de ${Math.min(stale.items.length, 5)} anúncio(s) parados`,
      detail: stale.items
        .slice(0, 2)
        .map((s) => s.title.slice(0, 40))
        .join(" · "),
      link: "/saude-da-loja",
    });
  if (opps[0])
    drafts.push({
      key: `oportunidade-${opps[0].productId}`,
      title: `Anunciar "${opps[0].name.slice(0, 50)}"`,
      detail: `${opps[0].soldQty} vendas entre os lojistas da Shoppfy nos últimos 30 dias.`,
      link: "/criar-anuncio",
    });

  const tasks = await safe(ensureWeeklyTasks(userId, drafts), [] as WeeklyTask[]);

  return {
    connected,
    reputation,
    scores,
    stale: stale.items.slice(0, 30),
    shopeeStaleReady: stale.shopeeReady,
    mlQuality: quality.filter((q) => q.score !== null || q.actions.length),
    opportunities: opps,
    tasks,
    weekStart: mondayOf(),
  };
}
