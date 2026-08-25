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
//
// Reset diário: as vendas simuladas vão acumulando o dia inteiro e voltam
// pra zero à meia-noite (horário de Brasília), sem precisar de cron. Guarda
// em qual dia (America/Sao_Paulo) foi a última atualização; se o dia mudou,
// zera antes de somar a venda nova. O lado da leitura (useEffectiveBoost)
// também considera "stale" um valor de um dia anterior, então a tela já
// volta pra R$0 extra no primeiro re-render depois da virada, mesmo sem
// nenhuma venda nova ainda.

function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

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
  lastResetDay: string;
  addSale: (amountCents: number, productTitle: string, channel: string) => void;
  reset: () => void;
};

export const useDemoBoostStore = create<DemoBoostState>()(
  persist(
    (set) => ({
      extraEarningsCents: 0,
      extraSales: 0,
      recentSales: [],
      lastResetDay: todaySP(),
      addSale: (amountCents, productTitle, channel) => {
        set((state) => {
          const today = todaySP();
          const stale = state.lastResetDay !== today;
          const prevEarnings = stale ? 0 : state.extraEarningsCents;
          const prevSales = stale ? 0 : state.extraSales;
          const prevRecent = stale ? [] : state.recentSales;

          return {
            lastResetDay: today,
            extraEarningsCents: prevEarnings + amountCents,
            extraSales: prevSales + 1,
            recentSales: [
              { id: `boost-${Date.now()}`, amountCents, productTitle, channel },
              ...prevRecent,
            ].slice(0, 10),
          };
        });

        // Fire-and-forget: não trava a UI local se a rede/Supabase falhar.
        // O reset diário do lado do painel é resolvido no próprio banco
        // (increment_panel_commission já zera sozinho se o dia mudou).
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
      reset: () => set({ extraEarningsCents: 0, extraSales: 0, recentSales: [], lastResetDay: todaySP() }),
    }),
    { name: "shoppfy.demo-boost" },
  ),
);

// Selector "seguro": ignora o valor guardado se ele for de um dia anterior
// (horário de Brasília), sem precisar de nenhum timer/interval pra disparar
// o reset — a própria leitura já devolve 0 assim que vira o dia.
export function useEffectiveBoost() {
  const extraEarningsCents = useDemoBoostStore((s) => s.extraEarningsCents);
  const extraSales = useDemoBoostStore((s) => s.extraSales);
  const lastResetDay = useDemoBoostStore((s) => s.lastResetDay);

  const stale = lastResetDay !== todaySP();

  return {
    extraEarningsCents: stale ? 0 : extraEarningsCents,
    extraSales: stale ? 0 : extraSales,
  };
}
