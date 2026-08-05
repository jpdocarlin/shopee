import { LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";

import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/data/demo-products";
import { cn } from "@/lib/utils";

export type SortKey = "score" | "commission" | "price-asc" | "price-desc" | "sales";

export type ProductFilterState = {
  query: string;
  marketplace: string;
  category: string;
  sort: SortKey;
  onlyFavorites: boolean;
};

export const DEFAULT_FILTERS: ProductFilterState = {
  query: "",
  marketplace: "all",
  category: "all",
  sort: "score",
  onlyFavorites: false,
};

type Props = {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  total: number;
};

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "score", label: "Melhor oportunidade" },
  { value: "commission", label: "Maior comissão" },
  { value: "sales", label: "Mais vendidos" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
];

export function ProductFilters({
  value,
  onChange,
  view,
  onViewChange,
  total,
}: Props) {
  const set = <K extends keyof ProductFilterState>(
    key: K,
    val: ProductFilterState[K],
  ) => onChange({ ...value, [key]: val });

  const dirty =
    value.query !== "" ||
    value.marketplace !== "all" ||
    value.category !== "all" ||
    value.sort !== "score" ||
    value.onlyFavorites;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft lg:flex-row lg:items-center">
      <SearchInput
        value={value.query}
        onChange={(v) => set("query", v)}
        placeholder="Buscar por produto, categoria ou loja…"
        className="lg:max-w-sm lg:flex-1"
      />

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <Select
          value={value.marketplace}
          onValueChange={(v) => set("marketplace", v)}
        >
          <SelectTrigger className="h-9 w-[150px] bg-background text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="shopee">Shopee</SelectItem>
            <SelectItem value="mercado-livre">Mercado Livre</SelectItem>
          </SelectContent>
        </Select>

        <Select value={value.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger className="h-9 w-[150px] bg-background text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {PRODUCT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.sort}
          onValueChange={(v) => set("sort", v as SortKey)}
        >
          <SelectTrigger className="h-9 w-[180px] bg-background text-[13px]">
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

        <Button
          variant={value.onlyFavorites ? "secondary" : "outline"}
          size="sm"
          className="h-9 text-[13px]"
          onClick={() => set("onlyFavorites", !value.onlyFavorites)}
        >
          Favoritos
        </Button>

        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-[13px] text-muted-foreground"
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            <X className="size-3.5" />
            Limpar
          </Button>
        )}

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          {(["grid", "list"] as const).map((v) => {
            const Icon = v === "grid" ? LayoutGrid : List;
            return (
              <button
                key={v}
                type="button"
                aria-label={v === "grid" ? "Visualização em grade" : "Visualização em lista"}
                onClick={() => onViewChange(v)}
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors duration-150",
                  view === v
                    ? "bg-surface-hover text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground lg:pl-1">
        {total} {total === 1 ? "produto" : "produtos"}
      </span>
    </div>
  );
}