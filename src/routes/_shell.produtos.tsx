import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { PackageSearch, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { ProductStats } from "@/components/products/product-stats";
import { ProductCard } from "@/components/products/product-card";
import { ProductRow } from "@/components/products/product-row";
import { ProductDetailDrawer } from "@/components/products/product-detail-drawer";
import { TopByNiche } from "@/components/products/top-by-niche";
import {
  DEFAULT_FILTERS,
  ProductFilters,
  type ProductFilterState,
} from "@/components/products/product-filters";
import { DEMO_PRODUCTS, type DemoProduct } from "@/data/demo-products";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · Shoppfy" },
      {
        name: "description",
        content: "Base central dos produtos monitorados, com preço, comissão e histórico.",
      },
      { property: "og:title", content: "Produtos · Shoppfy" },
      {
        property: "og:description",
        content: "Base central dos produtos monitorados, com preço, comissão e histórico.",
      },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const t = useT();
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const favorites = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const products = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = DEMO_PRODUCTS.filter((p) => {
      if (filters.marketplace !== "all" && p.marketplace !== filters.marketplace) return false;
      if (filters.category !== "all" && p.category !== filters.category) return false;
      if (filters.onlyFavorites && !favorites.includes(p.id)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.seller.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (filters.sort) {
        case "commission":
          return b.priceCents * b.commissionRate - a.priceCents * a.commissionRate;
        case "sales":
          return b.sales - a.sales;
        case "price-asc":
          return a.priceCents - b.priceCents;
        case "price-desc":
          return b.priceCents - a.priceCents;
        default:
          return b.score - a.score;
      }
    });
    return sorted;
  }, [filters, favorites]);

  const openProduct = (product: DemoProduct) => {
    setSelected(product);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Produtos")}
        description={t(
          "Catálogo de produtos disponíveis para afiliação na Shopee e no Mercado Livre.",
        )}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-[13px]"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              toast.success(t("Catálogo atualizado"));
            }}
          >
            <RotateCcw className="size-3.5" />
            {t("Atualizar")}
          </Button>
        }
      />

      <Stagger className="space-y-6">
        <ProductStats products={DEMO_PRODUCTS} />

        <StaggerItem>
          <ProductFilters
            value={filters}
            onChange={setFilters}
            view={view}
            onViewChange={setView}
            total={products.length}
          />
        </StaggerItem>
      </Stagger>

      <TopByNiche products={DEMO_PRODUCTS} onOpen={openProduct} />

      {products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto encontrado"
          description="Ajuste a busca ou remova os filtros ativos para ver mais oportunidades."
          action={
            <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Limpar filtros
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorite={favorites.includes(product.id)}
                onToggleFavorite={toggleFavorite}
                onOpen={openProduct}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Reveal className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              favorite={favorites.includes(product.id)}
              onToggleFavorite={toggleFavorite}
              onOpen={openProduct}
            />
          ))}
        </Reveal>
      )}

      <p className="text-[12px] text-muted-foreground">
        MVP com catálogo de demonstração. A integração real com Shopee e Mercado Livre alimenta esta
        mesma interface na próxima etapa.
      </p>

      <ProductDetailDrawer
        product={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        favorite={selected ? favorites.includes(selected.id) : false}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
