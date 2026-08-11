import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  MousePointerClick,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MarketplaceBadge } from "@/components/products/marketplace-badge";
import { ProductRow } from "@/components/products/product-row";
import {
  DAILY_SERIES_BY_PERIOD,
  type DashboardPeriod,
  PERIOD_LABELS,
  PERIOD_STATS,
  RECENT_ACTIVITY,
  TOP_PRODUCTS,
  TOP_SOLD_BY_PERIOD,
} from "@/data/demo-dashboard";
import { getGreeting } from "@/lib/greeting";
import { formatBRL, formatCompact } from "@/lib/format";
import { useProfileStore } from "@/stores/profile-store";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useAuthStore } from "@/stores/auth-store";
import { useIsOwner } from "@/lib/owner";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/translations";

const ZERO_STATS = {
  earningsCents: 0,
  earningsDeltaPct: 0,
  clicks: 0,
  clicksToday: 0,
  sales: 0,
  activeProducts: 0,
};

const PERIODS: DashboardPeriod[] = ["today", "7d", "30d"];

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Shoppfy" },
      {
        name: "description",
        content: "Visão consolidada de cliques, conversões e comissões dos seus links de afiliado.",
      },
      { property: "og:title", content: "Dashboard · Shoppfy" },
      {
        property: "og:description",
        content: "Visão consolidada de cliques, conversões e comissões dos seus links de afiliado.",
      },
    ],
  }),
  component: IndexPage,
});

const ONBOARDING_STEPS = [
  {
    id: "connect",
    title: "Conectar sua conta Shopee ou Mercado Livre",
    description: "Gratuito, aprova em poucos dias",
    to: "/marketplace",
  },
  {
    id: "product",
    title: "Buscar seu primeiro produto",
    description: "A gente já mostra os que vendem mais",
    to: "/produtos",
  },
  {
    id: "content",
    title: "Criar seu primeiro conteúdo com IA",
    description: "Gerado pra você, sem precisar editar",
    to: "/ia",
  },
] as const;

const chartConfig = {
  clicks: {
    label: "Cliques",
    color: "var(--brand)",
  },
} satisfies ChartConfig;

function IndexPage() {
  const t = useT();
  const name = useProfileStore((s) => s.name);
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  const marketplaceConnected = useAuthStore((s) => Boolean(s.marketplaceConnected));
  const hasAnyLink = useAffiliateStore((s) => Object.keys(s.links).length > 0);
  const isOwner = useIsOwner();
  const [contentDone, setContentDone] = useState(false);
  const favorites = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const [period, setPeriod] = useState<DashboardPeriod>("7d");

  const doneSteps = useMemo(() => {
    const next = new Set<string>();
    if (marketplaceConnected) next.add("connect");
    if (hasAnyLink) next.add("product");
    if (contentDone) next.add("content");
    return next;
  }, [marketplaceConnected, hasAnyLink, contentDone]);

  const doneCount = doneSteps.size;
  const progressPct = Math.round((doneCount / ONBOARDING_STEPS.length) * 100);

  const toggleStep = (id: string) => {
    // "connect" e "product" refletem estado real (conta conectada / link salvo)
    // e não podem ser marcados manualmente — só "content" ainda é local.
    if (id === "content") setContentDone((prev) => !prev);
  };

  // Dados de demonstração só aparecem pra conta do dono — qualquer outra
  // conta que logar vê a ferramenta zerada, como um usuário novo de verdade.
  const periodStats = isOwner ? PERIOD_STATS[period] : ZERO_STATS;

  const statCards = useMemo(
    () => [
      {
        key: "earnings",
        label: "Ganhos no período",
        value: formatBRL(periodStats.earningsCents),
        delta: isOwner
          ? `+${periodStats.earningsDeltaPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
          : "Sem vendas ainda",
        icon: Wallet,
        highlight: true,
      },
      {
        key: "clicks",
        label: "Cliques no seu link",
        value: formatCompact(periodStats.clicks),
        delta: isOwner ? `${periodStats.clicksToday} hoje` : "0 hoje",
        icon: MousePointerClick,
        highlight: false,
      },
      {
        key: "sales",
        label: "Vendas atribuídas",
        value: String(periodStats.sales),
        delta: isOwner ? `${periodStats.activeProducts} produtos ativos` : "0 produtos ativos",
        icon: ShoppingCart,
        highlight: false,
      },
    ],
    [periodStats, isOwner],
  );

  const dailySeries = useMemo(
    () =>
      isOwner
        ? DAILY_SERIES_BY_PERIOD[period]
        : DAILY_SERIES_BY_PERIOD[period].map((point) => ({ ...point, clicks: 0, conversion: 0 })),
    [period, isOwner],
  );
  const topSold = isOwner ? TOP_SOLD_BY_PERIOD[period] : [];
  const recentActivity = isOwner ? RECENT_ACTIVITY : [];

  return (
    <div className="space-y-7">
      <PageHeader
        title={name ? `${t(greeting)}, ${name}` : `${t(greeting)}!`}
        description={t(
          "Visão consolidada de cliques, conversões e comissões dos seus links de afiliado.",
        )}
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-hover/60 p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  period === p
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        }
      />

      {/* Onboarding */}
      <Reveal>
        <div className="surface-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div
                className="relative grid size-14 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--brand) ${progressPct}%, var(--surface-hover) 0)`,
                }}
              >
                <div className="grid size-11 place-items-center rounded-full bg-surface text-[12px] font-semibold text-foreground">
                  {doneCount}/{ONBOARDING_STEPS.length}
                </div>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">
                  {doneCount === 0 ? "Vamos começar" : "Você já começou"}
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  Falta pouco pro primeiro link no ar
                </p>
              </div>
            </div>

            <div className="grid flex-1 gap-2.5 sm:grid-cols-3">
              {ONBOARDING_STEPS.map((step) => {
                const done = doneSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border border-border bg-surface-hover/60 px-3 py-2.5",
                      done && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      aria-label={done ? "Marcar como pendente" : "Marcar como concluído"}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors",
                        done && "border-success bg-success text-success-foreground",
                      )}
                    >
                      <Check className="size-3" />
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[12.5px] font-medium text-foreground",
                          done && "line-through",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button asChild size="sm" className="shrink-0">
              <Link to="/produtos">
                Continuar
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Stat cards */}
      <Stagger stagger={0.06} className="grid gap-3 sm:grid-cols-3">
        {statCards.map((stat) => (
          <StaggerItem key={stat.key}>
            <div
              className={cn(
                "surface-card flex flex-col gap-3 p-5",
                stat.highlight && "border-brand/25 bg-gradient-to-b from-brand/10 to-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg border border-border bg-surface-hover text-muted-foreground",
                    stat.highlight && "border-brand/30 text-brand",
                  )}
                >
                  <stat.icon className="size-4" />
                </span>
              </div>
              <p
                className={cn(
                  "text-[26px] font-semibold tracking-tight text-foreground",
                  stat.highlight && "text-brand",
                )}
              >
                {stat.value}
              </p>
              <p className="text-[12px] text-muted-foreground">{stat.delta}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Chart */}
      <Reveal>
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-foreground">Cliques e conversão</p>
              <p className="text-[12px] text-muted-foreground">{PERIOD_LABELS[period]}</p>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={dailySeries} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="url(#fillClicks)"
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </Reveal>

      {/* Produtos que mais vendi */}
      <Reveal className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-brand" />
            <p className="text-[14px] font-medium text-foreground">Produtos que mais vendi</p>
          </div>
          <span className="text-[12px] text-muted-foreground">{PERIOD_LABELS[period]}</span>
        </div>
        {topSold.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground">
            Nenhuma venda atribuída nesse período ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {topSold.map(({ product, unitsSold, revenueCents }, index) => (
              <div key={product.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-4 shrink-0 text-[12px] font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-hover">
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {product.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <MarketplaceBadge marketplace={product.marketplace} />
                    <span>{product.category}</span>
                  </div>
                </div>
                <div className="hidden w-24 shrink-0 text-right sm:block">
                  <p className="text-[13px] font-semibold tabular-nums text-foreground">
                    {unitsSold}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {unitsSold === 1 ? "unidade" : "unidades"}
                  </p>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-success">
                    {formatBRL(revenueCents)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">comissão</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      {/* Top produtos + Atividade recente */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Reveal className="surface-card overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-brand" />
              <p className="text-[14px] font-medium text-foreground">Top produtos por comissão</p>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[12px]">
              <Link to="/produtos">
                Ver todos
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {TOP_PRODUCTS.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                favorite={favorites.includes(product.id)}
                onToggleFavorite={toggleFavorite}
                onOpen={() => {}}
              />
            ))}
          </div>
        </Reveal>

        <Reveal className="surface-card overflow-hidden xl:col-span-2">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Sparkles className="size-4 text-brand" />
            <p className="text-[14px] font-medium text-foreground">Atividade recente</p>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted-foreground">
                Nenhuma atividade ainda — assim que você tiver cliques ou vendas, aparecem aqui.
              </p>
            ) : (
              recentActivity.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      event.kind === "sale" && "bg-success",
                      event.kind === "click" && "bg-brand",
                      event.kind === "system" && "bg-muted-foreground",
                    )}
                  />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">
                    {event.label}
                  </p>
                  {event.amountCents ? (
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-success">
                      {formatBRL(event.amountCents)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{event.time}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </Reveal>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {isOwner
          ? "Dados de demonstração — conecte sua conta Shopee/Mercado Livre pra ver seus números reais."
          : "Suas vendas e ganhos aparecem aqui assim que começarem a entrar."}
      </p>
    </div>
  );
}
