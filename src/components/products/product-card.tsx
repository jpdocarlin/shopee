import { motion } from "motion/react";
import { ExternalLink, Heart, Star, Zap } from "lucide-react";

import { MarketplaceBadge } from "./marketplace-badge";
import { ScoreRing } from "./score-ring";
import { Button } from "@/components/ui/button";
import type { DemoProduct } from "@/data/demo-products";
import { formatBRL, formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  product: DemoProduct;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (product: DemoProduct) => void;
};

export function ProductCard({ product, favorite, onToggleFavorite, onOpen }: Props) {
  const discount = product.originalPriceCents
    ? Math.round((1 - product.priceCents / product.originalPriceCents) * 100)
    : 0;
  const commission = Math.round(product.priceCents * product.commissionRate);

  return (
    <motion.article
      layout
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-colors duration-200 hover:border-white/15"
    >
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="relative block aspect-square w-full overflow-hidden bg-surface-hover text-left"
      >
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <MarketplaceBadge marketplace={product.marketplace} />
          {discount > 0 && (
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-brand-foreground">
              -{discount}%
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpen(product)}
            className="line-clamp-2 text-left text-[13px] font-medium leading-snug text-foreground transition-colors hover:text-brand"
          >
            {product.title}
          </button>
          <ScoreRing value={product.score} />
        </div>

        <div className="flex items-end gap-2">
          <span className="text-[17px] font-semibold tracking-tight text-foreground">
            {formatBRL(product.priceCents)}
          </span>
          {product.originalPriceCents && (
            <span className="pb-0.5 text-[12px] text-muted-foreground line-through">
              {formatBRL(product.originalPriceCents)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-current text-warning" />
            {product.rating.toFixed(1)}
          </span>
          <span>{formatCompact(product.sales)} vendas</span>
          <span className="truncate">{product.category}</span>
        </div>

        {product.fastDelivery && (
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
            <Zap className="size-3 fill-current" />
            Entrega Rápida
          </span>
        )}

        <div className="mt-auto flex items-center justify-between rounded-lg border border-border/70 bg-surface-hover px-2.5 py-2">
          <div className="leading-tight">
            <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Comissão {formatPercent(product.commissionRate)}
            </p>
            <p className="text-[13px] font-semibold text-success">{formatBRL(commission)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Favoritar"
              onClick={() => onToggleFavorite(product.id)}
              className="size-8"
            >
              <Heart
                className={cn("size-4 transition-colors", favorite && "fill-brand text-brand")}
              />
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 px-2.5 text-[12px]">
              <a href={product.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5" />
                Ver anúncio
              </a>
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
