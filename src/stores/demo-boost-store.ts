import { create } from "zustand";
import { persist } from "zustand/middleware";

// Store da "bolinha" de demo no header — clicar nela simula uma venda
// aprovada chegando (pro dono mostrar o app "vivo" numa demonstração pra
// alguém). Soma em cima dos números estáticos de src/data/demo-dashboard.ts,
// nunca os modifica diretamente.

export type BoostSale = {
  id: string;
  amountCents: number;
  productTitle: string;
  channel: string;
};

type DemoBoostState = {
  extraEarningsCents: number;
  extraSales: number;
  recentSales: BoostSale[];
  addSale: (amountCents: number, productTitle: string, channel: string) => void;
  reset: () => void;
};

export const useDemoBoostStore = create<DemoBoostState>()(
  persist(
    (set) => ({
      extraEarningsCents: 0,
      extraSales: 0,
      recentSales: [],
      addSale: (amountCents, productTitle, channel) =>
        set((state) => ({
          extraEarningsCents: state.extraEarningsCents + amountCents,
          extraSales: state.extraSales + 1,
          recentSales: [
            { id: `boost-${Date.now()}`, amountCents, productTitle, channel },
            ...state.recentSales,
          ].slice(0, 10),
        })),
      // Zera ao trocar de usuário no mesmo navegador — é só demonstração, não
      // pode "vazar" venda fake pra conta de outra pessoa.
      reset: () => set({ extraEarningsCents: 0, extraSales: 0, recentSales: [] }),
    }),
    { name: "shoppfy.demo-boost" },
  ),
);
