import { create } from "zustand";
import { persist } from "zustand/middleware";

// Favoritos compartilhados entre todas as telas que exibem produtos
// (Dashboard, Produtos, Favoritos). Uma única fonte de verdade: favoritar em
// qualquer lugar do app atualiza todas as outras telas e persiste local.

type FavoritesState = {
  ids: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  reset: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggleFavorite: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((favoriteId) => favoriteId !== id)
            : [...state.ids, id],
        })),
      isFavorite: (id) => get().ids.includes(id),
      // Zera ao trocar de usuário no mesmo navegador, pra favoritos de uma
      // conta nunca vazarem pra outra.
      reset: () => set({ ids: [] }),
    }),
    { name: "shoppfy.favorites" },
  ),
);
