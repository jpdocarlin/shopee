import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { C7DROP_PRODUCTS, type C7DropProduct } from "@/data/c7drop-products";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

// Categorias que vieram sujas da API da C7Drop: "Fora de Estoque" é usada
// como categoria em vez de flag de disponibilidade, e "Anúncios em Massa"
// tem curso/mentoria da própria C7Drop misturado (não é produto físico).
const EXCLUDED_CATEGORIES = new Set(["Fora de Estoque", "Anúncios em Massa"]);

const AVAILABLE_PRODUCTS = C7DROP_PRODUCTS.filter((p) => !EXCLUDED_CATEGORIES.has(p.category));

// Mostra os primeiros 12 produtos, e carrega mais 12 por vez conforme
// rola dentro da caixa de produtos (não a página inteira).
const PAGE_SIZE = 12;

// Não temos número de vendas real da C7Drop — o sinal de popularidade que
// existe de verdade nos dados é a própria categoria "Mais vendidos" que a
// C7Drop usa no catálogo dela. Igual ao padrão da aba Produtos, mas com o
// que a fonte de dados realmente oferece.
type SortKey = "relevancia" | "mais-vendidos" | "preco-asc" | "preco-desc";

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "relevancia", label: "Relevância" },
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "preco-asc", label: "Menor preço" },
  { value: "preco-desc", label: "Maior preço" },
];

function sortProducts(products: C7DropProduct[], sort: SortKey): C7DropProduct[] {
  if (sort === "preco-asc") return [...products].sort((a, b) => a.priceCents - b.priceCents);
  if (sort === "preco-desc") return [...products].sort((a, b) => b.priceCents - a.priceCents);
  if (sort === "mais-vendidos") {
    return [...products].sort((a, b) => {
      const aTop = a.category === "Mais vendidos" ? 1 : 0;
      const bTop = b.category === "Mais vendidos" ? 1 : 0;
      return bTop - aTop;
    });
  }
  return products;
}

type Props = {
  // Só precisa do id pra destacar o card selecionado — o chamador pode
  // derivar isso a partir de um DemoProduct adaptado (id prefixado "c7drop-").
  selected: Pick<C7DropProduct, "id"> | null;
  onSelect: (product: C7DropProduct) => void;
};

export function C7DropProductPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevancia");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? AVAILABLE_PRODUCTS.filter(
          (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
        )
      : AVAILABLE_PRODUCTS;
    return sortProducts(base, sort);
  }, [query, sort]);

  // Sempre que a busca ou a ordenação muda, volta a mostrar só a primeira leva.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, sort]);

  const products = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Carrega mais produtos quando o sentinela entra na área visível da
  // própria caixa de produtos (root = a caixa, não a página).
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    const root = scrollAreaRef.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto por nome ou categoria..."
            className="h-9 pl-9 text-[13px]"
          />
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-full bg-background text-[13px] sm:w-[180px]">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mb-2 text-[11.5px] text-muted-foreground">
        {filtered.length} produto{filtered.length === 1 ? "" : "s"} encontrado
        {filtered.length === 1 ? "" : "s"}
      </p>

      <div
        ref={scrollAreaRef}
        className="max-h-[480px] overflow-y-auto rounded-lg border border-border/60 bg-surface-hover/30 p-2.5"
      >
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
                    alt={product.name}
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
                    {product.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBRL(product.priceCents)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {filtered.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">
            Nenhum produto encontrado pra essa busca.
          </p>
        )}
      </div>
    </>
  );
}
