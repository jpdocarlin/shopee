import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ProductCard } from "@/components/products/product-card";
import { ProductDetailDrawer } from "@/components/products/product-detail-drawer";
import { DEMO_PRODUCTS, type DemoProduct } from "@/data/demo-products";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos · Shoppfy" },
      {
        name: "description",
        content: "Produtos salvos para acompanhar preço, comissão e disponibilidade.",
      },
      { property: "og:title", content: "Favoritos · Shoppfy" },
      {
        property: "og:description",
        content: "Produtos salvos para acompanhar preço, comissão e disponibilidade.",
      },
    ],
  }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const t = useT();
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const favoriteProducts = useMemo(
    () => DEMO_PRODUCTS.filter((p) => favoriteIds.includes(p.id)),
    [favoriteIds],
  );

  const openProduct = (product: DemoProduct) => {
    setSelected(product);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Favoritos")}
        description={t("Produtos salvos para acompanhar preço, comissão e disponibilidade.")}
      />

      {favoriteProducts.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nenhum favorito ainda"
          description="Clique no coração de qualquer produto no Dashboard ou em Produtos para salvá-lo aqui."
        />
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {favoriteProducts.map((product) => (
              <StaggerItem key={product.id}>
                <ProductCard
                  product={product}
                  favorite
                  onToggleFavorite={toggleFavorite}
                  onOpen={openProduct}
                />
              </StaggerItem>
            ))}
          </AnimatePresence>
        </Stagger>
      )}

      <ProductDetailDrawer
        product={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        favorite={selected ? favoriteIds.includes(selected.id) : false}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
