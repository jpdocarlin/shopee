import { create } from "zustand";
import { persist } from "zustand/middleware";

import { supabase } from "@/integrations/supabase/client";

// Store da "bolinha" de demo no header — clicar nela simula uma venda
// aprovada chegando (pro dono mostrar o app "vivo" numa demonstração pra
// alguém). Soma em cima dos números estáticos de src/data/demo-dashboard.ts,
// nunca os modifica diretamente.
//
// Cada clique também soma o valor no contador compartilhado do Supabase
// (tabela panel_sync), que o painel-shopee (dashboard público, projeto
// separado) lê por polling pra aumentar a comissão exibida lá — dá a
// sensação de que "uma venda no Shoppfy aumenta o lucro do painel".

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
      addSale: (amountCents, productTitle, channel) => {
        set((state) => ({
          extraEarningsCents: state.extraEarningsCents + amountCents,
          extraSales: state.extraSales + 1,
          recentSales: [
            { id: `boost-${Date.now()}`, amountCents, productTitle, channel },
            ...state.recentSales,
          ].slice(0, 10),
        }));

        // Fire-and-forget: não trava a UI local se a rede/Supabase falhar.
        supabase
          .rpc("increment_panel_commission", { amount_cents: amountCents })
          .then(({ error }) => {
            if (error) {
              console.error("[demo-boost] falha ao sincronizar com o painel:", error);
            }
          });
      },
      // Zera ao trocar de usuário no mesmo navegador — é só demonstração, não
      // pode "vazar" venda fake pra conta de outra pessoa.
      reset: () => set({ extraEarningsCents: 0, extraSales: 0, recentSales: [] }),
    }),
    { name: "shoppfy.demo-boost" },
  ),
);
