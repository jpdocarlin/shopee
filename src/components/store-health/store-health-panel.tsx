import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Eye,
  Lightbulb,
  Loader2,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import type { StoreReport } from "@/lib/store-health.functions";
import { cn } from "@/lib/utils";

export type Recap = {
  weekNumber: number;
  weekStart: string;
  visits: number | null;
  orders: number;
  revenueCents: number;
  profitCents: number;
};

function Trend({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur === null || prev === null || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[12px]",
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
    <div className="surface-card p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2 text-[22px] font-semibold text-foreground">
        {value} {trend}
      </p>
    </div>
  );
}

export function StoreHealthPanel({
  data,
  error,
  days,
}: {
  data: { report: StoreReport; recaps: Recap[] } | null;
  error: string | null;
  days: number;
}) {
  const r = data?.report;

  return (
    <>
      {error ? (
        <p className="surface-card px-4 py-8 text-center text-[13px] text-muted-foreground">
          {error}
        </p>
      ) : !r ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : r.listings.length === 0 ? (
        <div className="surface-card space-y-3 px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-foreground">
            Ainda não tem anúncios pra acompanhar
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            Conecte sua loja e publique pelo Criar Anúncio — a partir daí a gente acompanha visitas
            e vendas.
          </p>
          <Button asChild>
            <Link to="/criar-anuncio">Criar anúncio</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Eye}
              label={`Visitas (${days} dias)`}
              value={r.visits === null ? "—" : String(r.visits)}
              trend={<Trend cur={r.visits} prev={r.prevVisits} />}
            />
            <Kpi
              icon={ShoppingBag}
              label="Vendas"
              value={String(r.orders)}
              trend={<Trend cur={r.orders} prev={r.prevOrders} />}
            />
            <Kpi icon={Wallet} label="Lucro estimado" value={formatBRL(r.profitCents)} />
            <Kpi
              icon={TrendingUp}
              label="Conversão"
              value={
                r.conversion === null
                  ? "—"
                  : `${(r.conversion * 100).toFixed(1).replace(".", ",")}%`
              }
            />
          </div>
          {r.visits === null && (
            <p className="text-[12px] text-muted-foreground">
              As visitas começam a ser contadas a partir de hoje — em alguns dias os números
              aparecem aqui.
            </p>
          )}

          {r.suggestions.length > 0 && (
            <div className="surface-card divide-y divide-border">
              <p className="flex items-center gap-2 px-4 py-3 text-[14px] font-semibold text-foreground">
                <Lightbulb className="size-4 text-brand" /> Vale fazer agora
              </p>
              {r.suggestions.map((s, i) => (
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

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="surface-card">
              <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-[14px] font-semibold text-foreground">
                <Trophy className="size-4 text-brand" /> O que mais vendeu
              </p>
              {r.topProducts.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Nenhuma venda no período. Olhe os anúncios marcados abaixo — é por eles que
                  começa.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {r.topProducts.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
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
            <div className="surface-card">
              <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-[14px] font-semibold text-foreground">
                <AlertTriangle className="size-4 text-warning" /> Precisa de atenção
              </p>
              {r.attention.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Nada urgente agora.
                </p>
              ) : (
                <>
                  <ul className="space-y-1.5 px-4 py-3 text-[13px] text-foreground">
                    {r.attention.map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                  <Link
                    to="/anuncios"
                    className="block px-4 pb-3 text-[12.5px] text-brand underline underline-offset-2"
                  >
                    Ver em Meus anúncios
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="surface-card divide-y divide-border">
            <p className="px-4 py-3 text-[14px] font-semibold text-foreground">Recap das semanas</p>
            {(data?.recaps ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                Toda segunda de manhã você recebe o recap da semana no e-mail e no celular — e ele
                fica guardado aqui.
              </p>
            ) : (
              data?.recaps.map((w) => (
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
                    {w.visits ?? "—"} visitas · {w.orders} vendas · {formatBRL(w.revenueCents)} ·
                    lucro {formatBRL(w.profitCents)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
