import { DEMO_PRODUCTS, type DemoProduct } from "@/data/demo-products";

// Dados de demonstração — mesmo padrão de src/data/demo-products.ts.
// Troca por dados reais (Supabase: analytics_daily, orders, sales) assim que
// o pipeline de pedidos/vendas estiver ligado no app (login e conexão de
// marketplace já são reais — falta só a ingestão de vendas de fato).

export type DashboardPeriod = "today" | "7d" | "30d";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

type PeriodStats = {
  earningsCents: number;
  earningsDeltaPct: number;
  clicks: number;
  clicksToday: number;
  sales: number;
  activeProducts: number;
};

export const PERIOD_STATS: Record<DashboardPeriod, PeriodStats> = {
  today: {
    earningsCents: 53725,
    earningsDeltaPct: 22.5,
    clicks: 150,
    clicksToday: 150,
    sales: 6,
    activeProducts: 3,
  },
  "7d": {
    earningsCents: 415690,
    earningsDeltaPct: 19.8,
    clicks: 400,
    clicksToday: 150,
    sales: 16,
    activeProducts: 5,
  },
  "30d": {
    earningsCents: 1534260,
    earningsDeltaPct: 24.1,
    clicks: 1450,
    clicksToday: 150,
    sales: 58,
    activeProducts: 5,
  },
};

// Mantido por compatibilidade com quem ainda importa o "período padrão" (7 dias).
export const WEEKLY_STATS = PERIOD_STATS["7d"];

export type DailyPoint = {
  day: string;
  clicks: number;
  conversion: number;
};

// 30 pontos diários (06/07 a 04/08) — os últimos 7 e os últimos 30 são fatiados
// direto deste array pra manter os números do gráfico coerentes entre períodos.
export const DAILY_SERIES_30D: DailyPoint[] = [
  { day: "06/07", clicks: 5, conversion: 0.2 },
  { day: "07/07", clicks: 6, conversion: 0.2 },
  { day: "08/07", clicks: 7, conversion: 0.3 },
  { day: "09/07", clicks: 9, conversion: 0.3 },
  { day: "10/07", clicks: 8, conversion: 0.3 },
  { day: "11/07", clicks: 10, conversion: 0.4 },
  { day: "12/07", clicks: 12, conversion: 0.4 },
  { day: "13/07", clicks: 11, conversion: 0.4 },
  { day: "14/07", clicks: 13, conversion: 0.5 },
  { day: "15/07", clicks: 15, conversion: 0.5 },
  { day: "16/07", clicks: 14, conversion: 0.5 },
  { day: "17/07", clicks: 16, conversion: 0.6 },
  { day: "18/07", clicks: 15, conversion: 0.6 },
  { day: "19/07", clicks: 17, conversion: 0.6 },
  { day: "20/07", clicks: 19, conversion: 0.7 },
  { day: "21/07", clicks: 18, conversion: 0.7 },
  { day: "22/07", clicks: 20, conversion: 0.7 },
  { day: "23/07", clicks: 22, conversion: 0.8 },
  { day: "24/07", clicks: 21, conversion: 0.8 },
  { day: "25/07", clicks: 23, conversion: 0.8 },
  { day: "26/07", clicks: 20, conversion: 0.7 },
  { day: "27/07", clicks: 19, conversion: 0.7 },
  { day: "28/07", clicks: 17, conversion: 0.7 },
  { day: "29/07", clicks: 18, conversion: 0.8 },
  { day: "30/07", clicks: 24, conversion: 1.1 },
  { day: "31/07", clicks: 31, conversion: 0.9 },
  { day: "01/08", clicks: 40, conversion: 1.4 },
  { day: "02/08", clicks: 52, conversion: 1.6 },
  { day: "03/08", clicks: 47, conversion: 1.3 },
  { day: "04/08", clicks: 28, conversion: 1.0 },
];

export const DAILY_SERIES: DailyPoint[] = DAILY_SERIES_30D.slice(-7);

// "Hoje" precisa de granularidade por hora — um gráfico de tendência com um
// único ponto (o dia de hoje) fica praticamente vazio. Os cliques somam
// exatamente os 150 de PERIOD_STATS.today.clicks.
export const TODAY_HOURLY_SERIES: DailyPoint[] = [
  { day: "06h", clicks: 4, conversion: 0.1 },
  { day: "08h", clicks: 9, conversion: 0.3 },
  { day: "10h", clicks: 14, conversion: 0.5 },
  { day: "12h", clicks: 22, conversion: 0.8 },
  { day: "14h", clicks: 18, conversion: 0.6 },
  { day: "16h", clicks: 25, conversion: 0.9 },
  { day: "18h", clicks: 31, conversion: 1.2 },
  { day: "20h", clicks: 19, conversion: 0.7 },
  { day: "22h", clicks: 8, conversion: 0.3 },
];

export const DAILY_SERIES_BY_PERIOD: Record<DashboardPeriod, DailyPoint[]> = {
  today: TODAY_HOURLY_SERIES,
  "7d": DAILY_SERIES_30D.slice(-7),
  "30d": DAILY_SERIES_30D,
};

export type ActivityEvent = {
  id: string;
  kind: "sale" | "click" | "system";
  label: string;
  amountCents?: number;
  time: string;
};

// Usa os mesmos produtos e valores de "Produtos que mais vendi" de hoje, pra
// bater com o card de ganhos e a contagem de cliques do período.
export const RECENT_ACTIVITY: ActivityEvent[] = [
  {
    id: "act-1",
    kind: "sale",
    label: "Venda: Fadvan 5D W Extensões De Cílios",
    amountCents: 8954,
    time: "há 2 h",
  },
  {
    id: "act-2",
    kind: "sale",
    label: "Venda: Cílios Tufo Volumosos",
    amountCents: 8954,
    time: "há 5 h",
  },
  {
    id: "act-3",
    kind: "click",
    label: "150 cliques novos no seu link hoje",
    time: "hoje",
  },
  {
    id: "act-4",
    kind: "system",
    label: "Comissão da Shopee atualizada para 12% em Eletrônicos",
    time: "ontem",
  },
];

export const TOP_PRODUCTS = [...DEMO_PRODUCTS]
  .sort((a, b) => b.commissionRate - a.commissionRate)
  .slice(0, 4);

// ---------- Produtos que mais vendi ----------
// Ranking por unidades vendidas (atribuídas aos seus links), não por comissão
// do catálogo — por isso é uma lista separada do "Top produtos por comissão".

export type TopSoldEntry = {
  product: DemoProduct;
  unitsSold: number;
  revenueCents: number;
};

function findProduct(id: string): DemoProduct {
  const product = DEMO_PRODUCTS.find((p) => p.id === id);
  if (!product) throw new Error(`Produto não encontrado no catálogo: ${id}`);
  return product;
}

const CILIOS_FADVAN = findProduct("shopee-21235699753");
const CILIOS_TUFO = findProduct("shopee-51054692051");
const DELINEADOR = findProduct("shopee-27487505152");
const ORGANIZADOR = findProduct("shopee-58252152185");
const LAPIS_SOBRANCELHA = findProduct("shopee-40306686178");

// Comissão de cada produto distribuída proporcionalmente às unidades vendidas,
// somando exatamente o total de "Ganhos no período" (PERIOD_STATS.earningsCents)
// — évita o card de ganhos e a lista de produtos mostrarem números diferentes.
export const TOP_SOLD_BY_PERIOD: Record<DashboardPeriod, TopSoldEntry[]> = {
  today: [
    { product: CILIOS_FADVAN, unitsSold: 3, revenueCents: 26863 },
    { product: CILIOS_TUFO, unitsSold: 2, revenueCents: 17908 },
    { product: DELINEADOR, unitsSold: 1, revenueCents: 8954 },
  ],
  "7d": [
    { product: CILIOS_FADVAN, unitsSold: 6, revenueCents: 155884 },
    { product: CILIOS_TUFO, unitsSold: 4, revenueCents: 103923 },
    { product: DELINEADOR, unitsSold: 3, revenueCents: 77942 },
    { product: ORGANIZADOR, unitsSold: 2, revenueCents: 51961 },
    { product: LAPIS_SOBRANCELHA, unitsSold: 1, revenueCents: 25980 },
  ],
  "30d": [
    { product: CILIOS_FADVAN, unitsSold: 18, revenueCents: 476150 },
    { product: CILIOS_TUFO, unitsSold: 14, revenueCents: 370339 },
    { product: DELINEADOR, unitsSold: 11, revenueCents: 290980 },
    { product: ORGANIZADOR, unitsSold: 9, revenueCents: 238075 },
    { product: LAPIS_SOBRANCELHA, unitsSold: 6, revenueCents: 158716 },
  ],
};
