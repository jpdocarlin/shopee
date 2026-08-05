import { useMemo, useState } from "react";
import { ExternalLink, Flame, TrendingUp, Zap } from "lucide-react";

import { MarketplaceBadge } from "@/components/products/marketplace-badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORIES, type DemoProduct } from "@/data/demo-products";
import { formatBRL, formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  products: DemoProduct[];
  onOpen: (product: DemoProduct) => void;
};

export function TopByNiche({ products, onOpen }: Props) {
  const [niche, setNiche] = useState<string>(PRODUCT_CATEGORIES[0] ?? "all");

  const ranking = useMemo(
    () =>
      products
        .filter((p) => p.category === niche)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5),
    [products, niche],
  );

  const nicheSales = ranking.reduce((a, p) => a + p.sales, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
            <Flame className="size-4 text-brand" />
            Mais vendidos por nicho
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Ranking de vendas dentro de cada categoria para priorizar o que já converte.
          </p>
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {formatCompact(nicheSales)} vendas no top 5
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setNiche(c)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors duration-150",
              niche === c
                ? "border-transparent bg-surface-hover text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <ol className="divide-y divide-border">
        {ranking.map((product, i) => (
          <li
            key={product.id}
            className="flex items-center gap-3 p-3 transition-colors duration-150 hover:bg-surface-hover/60"
          >
            <span className="w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onOpen(product)}
              className="size-11 shrink-0 overflow-hidden rounded-lg border border-border"
            >
              <img
                src={product.image}
                alt={product.title}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(product)}
                className="block w-full truncate text-left text-[13.5px] font-medium text-foreground"
              >
                {product.title}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                <MarketplaceBadge marketplace={product.marketplace} />
                <span className="flex items-center gap-1 tabular-nums">
                  <TrendingUp className="size-3" />
                  {formatCompact(product.sales)} vendas
                </span>
                <span className="tabular-nums">
                  {formatPercent(product.commissionRate)} comissão
                </span>
                {product.fastDelivery && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                    <Zap className="size-3 fill-current" />
                    Entrega Rápida
                  </span>
                )}
              </div>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[13.5px] font-semibold tabular-nums text-foreground">
                {formatBRL(product.priceCents)}
              </p>
              <p className="text-[11.5px] tabular-nums text-muted-foreground">
                {formatBRL(Math.round(product.priceCents * product.commissionRate))} por venda
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-[12.5px]"
            >
              <a href={product.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5" />
                Ver anúncio
              </a>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
