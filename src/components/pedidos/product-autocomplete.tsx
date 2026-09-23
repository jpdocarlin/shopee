import { useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";

import { Input } from "@/components/ui/input";
import { C7DROP_PRODUCTS, type C7DropProduct } from "@/data/c7drop-products";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

// Mesmas categorias sujas excluídas no picker do Criar Anúncio: "Fora de
// Estoque" é usada como categoria em vez de flag de disponibilidade, e
// "Anúncios em Massa" é curso/mentoria da própria C7Drop, não produto físico.
const EXCLUDED_CATEGORIES = new Set(["Fora de Estoque", "Anúncios em Massa"]);
const CATALOG = C7DROP_PRODUCTS.filter((p) => !EXCLUDED_CATEGORIES.has(p.category));

// Lista curta o suficiente pra caber numa dropdown de formulário sem virar
// uma segunda tela de busca (isso já existe no C7DropProductPicker).
const MAX_SUGGESTIONS = 8;

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Dispara quando o revendedor escolhe um produto do catálogo — quem chama
  // decide o que fazer (normalmente: preencher o custo automaticamente).
  onSelectProduct: (product: C7DropProduct) => void;
  placeholder?: string;
  className?: string;
};

// Combobox leve: input de texto normal (aceita produto fora do catálogo,
// digitado livre) + sugestões do catálogo C7Drop aparecendo por baixo
// enquanto digita. Não usa Popover/Command porque aqui é só um campo de
// formulário — não precisa da complexidade de posicionamento/portal deles.
export function ProductAutocomplete({
  id,
  value,
  onChange,
  onSelectProduct,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const suggestions =
    query.length > 0
      ? CATALOG.filter((p) => p.name.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS)
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

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {suggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              // preventDefault no mousedown evita que o input perca foco e
              // feche a lista ANTES do onClick disparar.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectProduct(product);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors",
                "hover:bg-surface-hover",
              )}
            >
              <Package className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{product.name}</span>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">
                {formatBRL(product.priceCents)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
