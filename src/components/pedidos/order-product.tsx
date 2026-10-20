import { Package } from "lucide-react";

import { resolveOrderProduct } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type OrderLike = {
  product_id?: string | null;
  product_image_url?: string | null;
  product_name: string;
};

// Foto de capa + nome do produto do pedido — a MESMA foto do Criar Anúncio.
// Pedido novo já vem com id/foto; pedido antigo (nome digitado à mão) tenta
// achar o produto do catálogo mais parecido e mostra "No catálogo: ...".
export function OrderProduct({
  order,
  size = "sm",
  showCatalogMatch = false,
}: {
  order: OrderLike;
  size?: "sm" | "lg";
  showCatalogMatch?: boolean;
}) {
  const match = resolveOrderProduct(order);
  const image = order.product_image_url || match?.image || null;
  const differentName = match && match.name.trim() !== order.product_name.trim();
  const box = size === "lg" ? "size-16" : "size-11";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {image ? (
        <img
          src={image}
          alt={order.product_name}
          loading="lazy"
          className={cn(
            box,
            "shrink-0 rounded-lg border border-border bg-surface-hover object-cover",
          )}
        />
      ) : (
        <div
          className={cn(
            box,
            "grid shrink-0 place-items-center rounded-lg border border-border bg-surface-hover",
          )}
        >
          <Package className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "line-clamp-2 font-medium leading-snug text-foreground",
            size === "lg" ? "text-[13.5px]" : "text-[13px]",
          )}
        >
          {order.product_name}
        </p>
        {showCatalogMatch && differentName && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            No catálogo: {match.name}
          </p>
        )}
        {showCatalogMatch && !match && !order.product_image_url && (
          <p className="mt-0.5 text-[11px] text-amber-500">Produto não encontrado no catálogo</p>
        )}
      </div>
    </div>
  );
}
