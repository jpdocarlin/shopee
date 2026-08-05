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

export function ProductRow({ product, favorite, onToggleFavorite, onOpen }: Props) {
  const commission = Math.round(product.priceCents * product.commissionRate);

  return (
    <div className="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover">
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-hover"
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
          className="block max-w-xl truncate text-left text-[13px] font-medium text-foreground transition-colors hover:text-brand"
        >
          {product.title}
        </button>
        <div className="mt-1 flex items-center gap-2.5 text-[11.5px] text-muted-foreground">
          <MarketplaceBadge marketplace={product.marketplace} />
          <span>{product.category}</span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-current text-warning" />
            {product.rating.toFixed(1)}
          </span>
          <span className="hidden sm:inline">{formatCompact(product.sales)} vendas</span>
          {product.fastDelivery && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
              <Zap className="size-3 fill-current" />
              Entrega Rápida
            </span>
          )}
        </div>
      </div>

      <div className="hidden w-24 text-right md:block">
        <p className="text-[13px] font-semibold tabular-nums text-foreground">
          {formatBRL(product.priceCents)}
        </p>
        {product.originalPriceCents && (
          <p className="text-[11px] text-muted-foreground line-through">
            {formatBRL(product.originalPriceCents)}
          </p>
        )}
      </div>

      <div className="hidden w-24 text-right lg:block">
        <p className="text-[13px] font-semibold tabular-nums text-success">
          {formatBRL(commission)}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatPercent(product.commissionRate)}</p>
      </div>

      <ScoreRing value={product.score} className="hidden sm:grid" />

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Favoritar"
          onClick={() => onToggleFavorite(product.id)}
          className="size-8"
        >
          <Heart className={cn("size-4", favorite && "fill-brand text-brand")} />
        </Button>
        <Button asChild size="sm" variant="secondary" className="h-8 gap-1.5 px-2.5 text-[12px]">
          <a href={product.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="size-3.5" />
            Ver anúncio
          </a>
        </Button>
      </div>
    </div>
  );
}
