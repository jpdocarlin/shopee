import { ExternalLink, Heart, Star, Zap } from "lucide-react";

import { MarketplaceBadge } from "./marketplace-badge";
import { ScoreRing } from "./score-ring";
import { SideDrawer } from "@/components/shared/side-drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DemoProduct } from "@/data/demo-products";
import { formatBRL, formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  product: DemoProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function ProductDetailDrawer({
  product,
  open,
  onOpenChange,
  favorite,
  onToggleFavorite,
}: Props) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={product?.title ?? "Produto"}
      description={product ? `Vendido por ${product.seller}` : undefined}
      footer={
        product ? (
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => onToggleFavorite(product.id)}
              className="gap-2"
            >
              <Heart className={cn("size-4", favorite && "fill-brand text-brand")} />
              {favorite ? "Salvo" : "Salvar"}
            </Button>
            <Button asChild className="flex-1 gap-2">
              <a href={product.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-4" />
                Ver anúncio
              </a>
            </Button>
          </div>
        ) : null
      }
    >
      {product && (
        <div className="space-y-5 pb-4">
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface-hover">
            <img
              src={product.image}
              alt={product.title}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute left-3 top-3">
              <MarketplaceBadge marketplace={product.marketplace} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-[22px] font-semibold tracking-tight text-foreground">
                  {formatBRL(product.priceCents)}
                </span>
                {product.originalPriceCents && (
                  <span className="pb-1 text-[13px] text-muted-foreground line-through">
                    {formatBRL(product.originalPriceCents)}
                  </span>
                )}
              </div>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Star className="size-3 fill-current text-warning" />
                {product.rating.toFixed(1)} · {formatCompact(product.reviews)} avaliações
              </p>
              {product.fastDelivery && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                  <Zap className="size-3 fill-current" />
                  Entrega Rápida
                </span>
              )}
            </div>
            <ScoreRing value={product.score} size={48} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              label="Comissão"
              value={formatBRL(Math.round(product.priceCents * product.commissionRate))}
            />
            <Stat label="Taxa" value={formatPercent(product.commissionRate)} />
            <Stat label="Vendas" value={formatCompact(product.sales)} />
            <Stat label="Categoria" value={product.category} />
          </div>

          <div className="rounded-lg border border-dashed border-border bg-card/40 p-3.5">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Histórico de preço, curva de comissão e alertas de queda entram na próxima etapa deste
              módulo.
            </p>
          </div>

          <a
            href={product.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver anúncio original
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </SideDrawer>
  );
}
