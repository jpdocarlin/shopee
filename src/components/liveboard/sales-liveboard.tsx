import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  LIVEBOARD_METRICS,
  LIVEBOARD_SERIES,
  LIVEBOARD_TOP_PRODUCTS,
  LIVEBOARD_TOTAL_CENTS,
} from "@/data/liveboard";
import { formatBRL } from "@/lib/format";

function useClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "medium",
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function SalesLiveboard() {
  const now = useClock();
  const total = formatBRL(LIVEBOARD_TOTAL_CENTS);
  const [currency, amount] = [total.slice(0, 2), total.slice(2).trim()];

  return (
    <div className="overflow-hidden rounded-xl border border-lb-border bg-lb-bg text-lb-text shadow-elevated">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-lb-border bg-lb-panel px-4 py-2.5 text-[12.5px] text-lb-muted">
        <span>Informações Gerenciais</span>
        <div className="flex items-center gap-3">
          <span>Tipo de Pedido</span>
          <span className="rounded-md border border-lb-border px-2 py-1">Produto Pago</span>
        </div>
      </div>

      {/* Header vermelho */}
      <div className="relative bg-[linear-gradient(180deg,var(--lb-red)_0%,var(--lb-red-soft)_100%)] px-4 pb-14 pt-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="grid size-5 place-items-center rounded-[4px] bg-white/90 text-[11px] font-bold text-lb-red">
            S
          </span>
          <span className="text-[17px] font-medium text-white">Shopee</span>
        </div>
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-white">
          Vendas Hoje
        </h1>
        <p className="mt-1 inline-block rounded bg-black/15 px-2 py-0.5 text-[11.5px] text-white/90 tabular-nums">
          {now} (GMT-03)
        </p>
      </div>

      {/* Card do total */}
      <div className="-mt-10 px-4">
        <div className="mx-auto max-w-md rounded-lg bg-[oklch(0.985_0.01_80)] px-6 py-5 text-center shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]">
          <span className="align-top text-[24px] font-semibold text-lb-red">{currency}</span>{" "}
          <span className="text-[44px] font-bold leading-none tracking-tight text-lb-red tabular-nums">
            {amount}
          </span>
        </div>
      </div>

      {/* Painéis */}
      <div className="grid gap-3 p-4 lg:grid-cols-[280px_1fr_300px]">
        {/* Métricas principais */}
        <section className="rounded-lg border border-lb-border bg-lb-panel p-4">
          <h2 className="text-[13.5px] font-medium text-lb-text">Métricas Principais</h2>
          <div className="mt-4 grid grid-cols-2 gap-y-5">
            {LIVEBOARD_METRICS.map((m) => (
              <div key={m.label}>
                <p className="text-[11.5px] text-lb-red">{m.label}</p>
                <p className="mt-1 text-[18px] font-semibold text-lb-text tabular-nums">
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tendência de vendas */}
        <section className="rounded-lg border border-lb-border bg-lb-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13.5px] font-medium text-lb-text">Tendência de Vendas</h2>
            <div className="flex items-center gap-4 text-[11.5px] text-lb-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-lb-red" /> Hoje
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-lb-compare" /> Ontem
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-lb-muted">Vendas(R$)</p>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={LIVEBOARD_SERIES} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
                <CartesianGrid stroke="var(--lb-border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  interval={1}
                  tick={{ fill: "var(--lb-muted)", fontSize: 11 }}
                  stroke="var(--lb-border)"
                />
                <YAxis
                  domain={[0, 250]}
                  ticks={[0, 50, 100, 150, 200, 250]}
                  tick={{ fill: "var(--lb-muted)", fontSize: 11 }}
                  stroke="var(--lb-border)"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--lb-panel)",
                    border: "1px solid var(--lb-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--lb-text)",
                  }}
                  formatter={(v: number) => formatBRL(Number(v) * 100)}
                  labelFormatter={(l) => `${l}h`}
                />
                <Line
                  type="linear"
                  dataKey="yesterday"
                  name="Ontem"
                  stroke="var(--lb-compare)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="today"
                  name="Hoje"
                  stroke="var(--lb-red)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-right text-[11px] text-lb-muted">Hora</p>
        </section>

        {/* Top 5 produtos */}
        <section className="rounded-lg border border-lb-border bg-lb-panel p-4">
          <h2 className="text-[13.5px] font-medium text-lb-text">
            Top 5 dos Produtos à Venda
          </h2>
          <ol className="mt-3 divide-y divide-lb-border">
            {LIVEBOARD_TOP_PRODUCTS.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2.5 py-2.5">
                <span className="w-3 shrink-0 text-[11.5px] text-lb-muted tabular-nums">
                  {i + 1}
                </span>
                <img
                  src={p.image}
                  alt={p.title}
                  loading="lazy"
                  className="size-9 shrink-0 rounded border border-lb-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[11.5px] leading-snug text-lb-text">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-lb-muted tabular-nums">
                    {p.units} un · {formatBRL(p.revenueCents)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}