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
  // Centavos que ainda faltam sincronizar com o painel-shopee. O
  // increment_panel_commission é "fire-and-forget" — se a chamada falhar
  // (rede caiu, aba em segundo plano, etc.) a venda ficava perdida pra
  // sempre, sem avisar ninguém. Agora ela fica guardada aqui até confirmar
  // que chegou no banco, e flushPendingSync tenta de novo periodicamente.
  pendingSyncCents: number;
  pendingSyncDay: string;
  addSale: (amountCents: number, productTitle: string, channel: string) => void;
  flushPendingSync: () => void;
  reset: () => void;
};

export const useDemoBoostStore = create<DemoBoostState>()(
  persist(
    (set, get) => ({
      extraEarningsCents: 0,
      extraSales: 0,
      recentSales: [],
      lastResetDay: todaySP(),
      pendingSyncCents: 0,
      pendingSyncDay: todaySP(),
      addSale: (amountCents, productTitle, channel) => {
        const today = todaySP();
        set((state) => {
          const stale = state.lastResetDay !== today;
          const prevEarnings = stale ? 0 : state.extraEarningsCents;
          const prevSales = stale ? 0 : state.extraSales;
          const prevRecent = stale ? [] : state.recentSales;
          const pendingStale = state.pendingSyncDay !== today;
          const prevPending = pendingStale ? 0 : state.pendingSyncCents;

          return {
            lastResetDay: today,
            extraEarningsCents: prevEarnings + amountCents,
            extraSales: prevSales + 1,
            recentSales: [
              { id: `boost-${Date.now()}`, amountCents, productTitle, channel },
              ...prevRecent,
            ].slice(0, 10),
            pendingSyncCents: prevPending + amountCents,
            pendingSyncDay: today,
          };
        });

        get().flushPendingSync();
      },
      // Tenta mandar pro Supabase tudo que ainda não confirmou sincronizar.
      // Chamado a cada venda nova, e também periodicamente/on-reconnect (ver
      // final do arquivo) — assim, se uma chamada falhar, ela não fica perdida:
      // a próxima tentativa (nova venda, reconexão, ou o timer) reenvia o
      // valor pendente. Só desiste do valor se o dia virou antes de sincronizar
      // (mesma regra do reset diário — venda de ontem não conta mais hoje).
      flushPendingSync: () => {
        const state = get();
        const today = todaySP();
        if (state.pendingSyncDay !== today) {
          set({ pendingSyncCents: 0, pendingSyncDay: today });
          return;
        }
        const amount = state.pendingSyncCents;
        if (amount <= 0) return;

        supabase.rpc("increment_panel_commission", { amount_cents: amount }).then(({ error }) => {
          if (error) {
            console.error(
              "[demo-boost] falha ao sincronizar com o painel, tentando de novo em breve:",
              error,
            );
            return;
          }
          // Só abate o que confirmou enviar agora — outra venda pode ter
          // aumentado pendingSyncCents nesse meio-tempo.
          set((s) => ({ pendingSyncCents: Math.max(0, s.pendingSyncCents - amount) }));
        });
      },
      // Zera ao trocar de usuário no mesmo navegador — é só demonstração, não
      // pode "vazar" venda fake pra conta de outra pessoa.
      reset: () =>
        set({
          extraEarningsCents: 0,
          extraSales: 0,
          recentSales: [],
          lastResetDay: todaySP(),
          pendingSyncCents: 0,
          pendingSyncDay: todaySP(),
        }),
    }),
    { name: "shoppfy.demo-boost" },
  ),
);

// Rede de segurança: se uma sincronização falhar (aba em segundo plano,
// internet caiu, etc.), essas tentativas periódicas garantem que o valor
// pendente eventualmente chega no painel sem precisar de outra venda pra
// disparar — ao voltar a conexão, ao focar a aba de novo, e a cada 20s.
if (typeof window !== "undefined") {
  const retry = () => useDemoBoostStore.getState().flushPendingSync();
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") retry();
  });
  window.setInterval(retry, 20_000);
  retry();
}

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
