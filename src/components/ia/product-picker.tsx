import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { DEMO_PRODUCTS, type DemoProduct } from "@/data/demo-products";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  selected: DemoProduct | null;
  onSelect: (product: DemoProduct) => void;
};

export function ProductPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEMO_PRODUCTS.slice(0, 12);
    return DEMO_PRODUCTS.filter(
      (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [query]);

  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto por nome ou categoria..."
          className="h-9 pl-9 text-[13px]"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map((product) => {
          const isSelected = selected?.id === product.id;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-lg border text-left transition-colors duration-150",
                isSelected
                  ? "border-brand bg-brand/5"
                  : "border-border bg-card hover:border-white/15",
              )}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-hover">
                <img
                  src={product.image}
                  alt={product.title}
                  loading="lazy"
                  className="size-full object-cover"
                />
                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-2 text-[11.5px] font-medium leading-snug text-foreground">
                  {product.title}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatBRL(product.priceCents)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
