import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Lightbulb,
  Loader2,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import type { ChannelReport, StoreReport } from "@/lib/store-health.functions";
import { cn } from "@/lib/utils";

export type Recap = {
  weekNumber: number;
  weekStart: string;
  visits: number | null;
  orders: number;
  revenueCents: number;
  profitCents: number;
};

type Channel = "shopee" | "mercado-livre";

export type StoreHealthData = {
  connected: Channel[];
  report: StoreReport;
  recaps: Recap[];
};

const STORE = {
  shopee: { name: "Shopee", logo: "/logo-shopee.png" },
  "mercado-livre": { name: "Mercado Livre", logo: "/logo-mercadolivre.png" },
} as const;

function Trend({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur === null || prev === null || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11.5px] font-medium",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-hover/40 p-3">
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2 text-[19px] font-semibold text-foreground">
        {value} {trend}
      </p>
    </div>
  );
}

function StoreCard({ c, days, wide }: { c: ChannelReport; days: number; wide: boolean }) {
  const store = STORE[c.marketplace];
  return (
    <div className="surface-card overflow-hidden">
      {/* Cabeçalho da loja */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-white">
          <img src={store.logo} alt={store.name} className="size-7 object-contain" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">{store.name}</p>
          <p className="text-[12px] text-muted-foreground">
            {c.listingsCount} anúncio(s) acompanhados
          </p>
        </div>
      </div>

      <div className={cn("grid gap-0", wide && "lg:grid-cols-2 lg:divide-x lg:divide-border")}>
        {/* Números + mais vendidos */}
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi
              icon={Eye}
              label={`Visitas (${days} dias)`}
              value={c.visits === null ? "—" : String(c.visits)}
              trend={<Trend cur={c.visits} prev={c.prevVisits} />}
            />
            <Kpi
              icon={ShoppingBag}
              label="Vendas"
              value={String(c.orders)}
              trend={<Trend cur={c.orders} prev={c.prevOrders} />}
            />
            <Kpi icon={Wallet} label="Lucro estimado" value={formatBRL(c.profitCents)} />
            <Kpi
              icon={TrendingUp}
              label="Conversão"
              value={
                c.conversion === null
                  ? "—"
                  : `${(c.conversion * 100).toFixed(1).replace(".", ",")}%`
              }
            />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
              <Trophy className="size-3.5 text-brand" /> Mais vendidos
            </p>
            {c.topProducts.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nenhuma venda no período.</p>
            ) : (
              <div className="space-y-1.5">
                {c.topProducts.map((p, i) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between gap-3 text-[12.5px]"
                  >
                    <span className="line-clamp-1 text-foreground">
                      {i + 1}. {p.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{p.qty} un.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Só os anúncios que precisam de revisão */}
        <div className={cn("border-t border-border", wide && "lg:border-t-0")}>
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
              <Wrench className="size-3.5 text-warning" /> Precisa de revisão
              {c.reviewCount > 0 && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                  {c.reviewCount}
                </span>
              )}
            </p>
            <Link
              to="/anuncios"
              className="inline-flex items-center gap-0.5 text-[12px] text-brand hover:underline"
            >
              Meus anúncios <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {c.review.length === 0 ? (
            <p className="flex items-center gap-2 px-5 pb-5 pt-1 text-[12.5px] text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> Nenhum anúncio precisando de revisão.
            </p>
          ) : (
            <div className="max-h-[340px] divide-y divide-border overflow-y-auto">
              {c.review.map((it) => (
                <div key={it.listingId} className="flex gap-3 px-5 py-2.5">
                  {it.imageUrl ? (
                    <img
                      src={it.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 rounded-md bg-surface-hover object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded-md bg-surface-hover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[12.5px] font-medium text-foreground">
                      {it.title}
                    </p>
                    {it.reasons.map((reason) => (
                      <p key={reason} className="text-[11.5px] text-muted-foreground">
                        • {reason}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {c.reviewCount > c.review.length && (
            <p className="border-t border-border px-5 py-2.5 text-[11.5px] text-muted-foreground">
              Mostrando os {c.review.length} mais urgentes de {c.reviewCount}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StoreHealthPanel({
  data,
  error,
  days,
}: {
  data: StoreHealthData | null;
  error: string | null;
  days: number;
}) {
  if (error) {
    return (
      <p className="surface-card px-4 py-8 text-center text-[13px] text-muted-foreground">
        {error}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const { report: r, connected, recaps } = data;
  if (connected.length === 0) {
    return (
      <div className="surface-card space-y-3 px-4 py-10 text-center">
        <p className="text-[14px] font-medium text-foreground">
          Conecte sua loja pra ver os números
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          Conecte a Shopee, o Mercado Livre ou os dois — cada loja ganha o seu painel com visitas,
          vendas, lucro e o que revisar.
        </p>
        <Button asChild>
          <Link to="/integracoes">Conectar loja</Link>
        </Button>
      </div>
    );
  }

  const stores = r.channels.filter((c) => connected.includes(c.marketplace));
  const wide = stores.length === 1;
  const suggestions = r.suggestions.filter((s) => connected.includes(s.marketplace));
  const noVisitsYet = stores.every((c) => c.visits === null);

  return (
    <>
      <div className={cn("grid gap-4", stores.length > 1 && "xl:grid-cols-2")}>
        {stores.map((c) => (
          <StoreCard key={c.marketplace} c={c} days={days} wide={wide} />
        ))}
      </div>
      {noVisitsYet && (
        <p className="text-[12px] text-muted-foreground">
          As visitas começam a ser contadas a partir de hoje — em alguns dias os números aparecem
          aqui.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="surface-card divide-y divide-border">
          <p className="flex items-center gap-2 px-4 py-3 text-[14px] font-semibold text-foreground">
            <Lightbulb className="size-4 text-brand" /> Vale fazer agora
          </p>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-[13px] font-medium text-foreground">{s.title}</p>
                <p className="text-[12px] text-muted-foreground">{s.detail}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/criar-anuncio">Criar anúncio</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="surface-card divide-y divide-border">
        <p className="px-4 py-3 text-[14px] font-semibold text-foreground">Recap das semanas</p>
        {recaps.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            Toda segunda de manhã você recebe o recap da semana no e-mail e no celular — e ele fica
            guardado aqui.
          </p>
        ) : (
          recaps.map((w) => (
            <div
              key={w.weekStart}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]"
            >
              <span className="font-medium text-foreground">
                Semana {w.weekNumber}{" "}
                <span className="font-normal text-muted-foreground">
                  ({w.weekStart.split("-").reverse().slice(0, 2).join("/")})
                </span>
              </span>
              <span className="text-muted-foreground">
                {w.visits ?? "—"} visitas · {w.orders} vendas · {formatBRL(w.revenueCents)} · lucro{" "}
                {formatBRL(w.profitCents)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
