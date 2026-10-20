import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { C7DropProduct } from "@/data/c7drop-products";
import { CATALOG } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

type Props = {
  id: string;
  selected: C7DropProduct | null;
  // null = revendedor limpou a escolha (clicou no X).
  onSelect: (product: C7DropProduct | null) => void;
  placeholder?: string;
  className?: string;
};

// Escolha do produto vendido: só aceita produto do catálogo (o mesmo nome e
// a mesma foto de capa que aparecem no Criar Anúncio). Antes aceitava texto
// livre e o dono não sabia qual produto separar.
export function ProductAutocomplete({ id, selected, onSelect, placeholder, className }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const suggestions =
    q.length > 0
      ? CATALOG.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
      : [];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-brand/40 bg-brand/5 p-2">
        <img
          src={selected.image}
          alt={selected.name}
          className="size-12 shrink-0 rounded-md bg-surface-hover object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">
            {selected.name}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Custo {formatBRL(selected.priceCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          aria-label="Trocar produto"
          title="Trocar produto"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && q.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {suggestions.length === 0 ? (
            <p className="px-3 py-2.5 text-[12px] text-muted-foreground">
              Nenhum produto com esse nome. Busque pelo nome que aparece no Criar Anúncio.
            </p>
          ) : (
            suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(product);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors",
                  "hover:bg-surface-hover",
                )}
              >
                <img
                  src={product.image}
                  alt=""
                  loading="lazy"
                  className="size-9 shrink-0 rounded bg-surface-hover object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{product.name}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">
                  {formatBRL(product.priceCents)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
