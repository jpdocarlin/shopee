import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DemoProduct } from "@/data/demo-products";
import { supabase } from "@/integrations/supabase/client";

// "Meus Links" já foi só localStorage (zustand/persist) — dois problemas:
// sumia sozinho se uma troca de sessão espúria disparava o reset dos stores
// locais, e nunca sincronizava entre aparelhos (localStorage é por navegador).
// Agora o localStorage vira só um cache pra UI abrir instantânea; a verdade
// mora na tabela affiliate_links do Supabase (RLS por user_id). O
// auth-provider chama setAffiliateUserId() a cada mudança de sessão e
// hydrateAffiliateLinksFromSupabase() ao logar, substituindo o cache local
// pelos links reais do usuário — funciona em qualquer aparelho que ele logar.

export type Marketplace = DemoProduct["marketplace"];

export const MARKETPLACE_SIGNUP_URL: Record<Marketplace, string> = {
  shopee: "https://affiliate.shopee.com.br",
  "mercado-livre": "https://www.mercadolivre.com.br/l/afiliados-home",
};

export const MARKETPLACE_LINK_TOOL_URL: Record<Marketplace, string> = {
  // Vai direto pra "Oferta de produto" (onde dá pra buscar o produto e pegar o
  // link de afiliado) em vez da home, que cai no Painel de controle/métricas.
  shopee: "https://affiliate.shopee.com.br/offer/product_offer",
  "mercado-livre": "https://www.mercadolivre.com.br/l/afiliados-gerar-link",
};

// Snapshot usado quando o produto não está no catálogo DEMO_PRODUCTS — hoje isso
// acontece quando a extensão do Chrome salva um link automaticamente a partir de
// QUALQUER página de produto real da Shopee, não só dos produtos pré-carregados.
export type SavedLinkMeta = {
  title: string;
  marketplace: Marketplace;
  image?: string;
  productUrl?: string;
  // Quem gerou esse link ad-hoc: a extensão do Chrome (padrão, quando o campo
  // não vem preenchido — mantém compatibilidade com o que já estava salvo) ou
  // o próprio usuário, colando manualmente em Meus Links.
  source?: "extension" | "manual";
};

type SavedLink = {
  url: string;
  savedAt: string;
  meta?: SavedLinkMeta;
};

type AffiliateState = {
  registered: Partial<Record<Marketplace, boolean>>;
  links: Record<string, SavedLink>;
  setRegistered: (marketplace: Marketplace, value: boolean) => void;
  isRegistered: (marketplace: Marketplace) => boolean;
  saveLink: (productId: string, url: string, meta?: SavedLinkMeta) => void;
  removeLink: (productId: string) => void;
  getLink: (productId: string) => SavedLink | undefined;
  hasAnyLink: () => boolean;
  reset: () => void;
  hydrateLinks: (links: Record<string, SavedLink>) => void;
};

// Id do usuário logado, mantido em sincronia pelo auth-provider a cada
// mudança de sessão. Fica fora do store (não precisa re-render) — só serve
// pra saber pra quem gravar/ler no Supabase. Null = ninguém logado (link
// fica só no cache local, sem escrever no banco).
let currentUserId: string | null = null;
export function setAffiliateUserId(userId: string | null) {
  currentUserId = userId;
}

export const useAffiliateStore = create<AffiliateState>()(
  persist(
    (set, get) => ({
      registered: {},
      links: {},
      setRegistered: (marketplace, value) =>
        set((state) => ({
          registered: { ...state.registered, [marketplace]: value },
        })),
      isRegistered: (marketplace) => Boolean(get().registered[marketplace]),
      saveLink: (productId, url, meta) => {
        const trimmed = url.trim();
        const savedAt = new Date().toISOString();
        set((state) => ({
          links: {
            ...state.links,
            [productId]: { url: trimmed, savedAt, meta },
          },
        }));

        // Write-through: fire-and-forget pro Supabase, a UI já atualizou local
        // e não precisa esperar a rede. Upsert por (user_id, product_id) —
        // salvar o mesmo produto de novo atualiza em vez de duplicar.
        if (currentUserId) {
          supabase
            .from("affiliate_links")
            .upsert(
              {
                user_id: currentUserId,
                product_id: productId,
                url: trimmed,
                meta: (meta ?? null) as never,
                saved_at: savedAt,
              },
              { onConflict: "user_id,product_id" },
            )
            .then(({ error }) => {
              if (error) console.error("[affiliate-store] falha ao salvar link no Supabase:", error);
            });
        }
      },
      removeLink: (productId) => {
        set((state) => {
          const next = { ...state.links };
          delete next[productId];
          return { links: next };
        });

        if (currentUserId) {
          supabase
            .from("affiliate_links")
            .delete()
            .eq("user_id", currentUserId)
            .eq("product_id", productId)
            .then(({ error }) => {
              if (error) console.error("[affiliate-store] falha ao remover link no Supabase:", error);
            });
        }
      },
      getLink: (productId) => get().links[productId],
      hasAnyLink: () => Object.keys(get().links).length > 0,
      // Zera ao trocar de usuário no mesmo navegador, pra links salvos de uma
      // conta nunca vazarem pra outra. Como a verdade agora mora no Supabase,
      // um reset espúrio (ex: sessão expirou) só limpa o cache local — o
      // próximo login de verdade recarrega os links certinho.
      reset: () => set({ registered: {}, links: {} }),
      hydrateLinks: (links) => set({ links }),
    }),
    { name: "shoppfy.affiliate" },
  ),
);

// Busca todos os links do usuário no Supabase e mescla no cache local —
// chamado pelo auth-provider ao restaurar sessão/logar, garante que qualquer
// aparelho novo mostre os mesmos links salvos.
//
// É uma MESCLA, não uma substituição: antes dessa migração, os links viviam
// só no localStorage (nunca foram escritos no Supabase). Se a gente
// simplesmente trocasse o cache local pelo que o banco conhece, quem já
// tinha links salvos veria todos sumirem no primeiro login depois do deploy
// — o banco ainda não sabia que eles existiam. Em vez disso: o Supabase
// ganha em caso de conflito (é a fonte de verdade pra tudo que ele já
// conhece), mas um link só-local que o banco ainda não tem continua visível,
// e essa função aproveita pra migrá-lo pro Supabase na hora — assim ele
// também passa a aparecer nos outros aparelhos dali em diante.
export async function hydrateAffiliateLinksFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from("affiliate_links")
    .select("product_id, url, meta, saved_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[affiliate-store] falha ao carregar links do Supabase:", error);
    return;
  }

  const remoteLinks: Record<string, SavedLink> = {};
  for (const row of data ?? []) {
    remoteLinks[row.product_id] = {
      url: row.url,
      savedAt: row.saved_at,
      meta: (row.meta as SavedLinkMeta | null) ?? undefined,
    };
  }

  const localLinks = useAffiliateStore.getState().links;
  useAffiliateStore.getState().hydrateLinks({ ...localLinks, ...remoteLinks });

  for (const [productId, link] of Object.entries(localLinks)) {
    if (remoteLinks[productId]) continue; // já sincronizado, nada a fazer

    supabase
      .from("affiliate_links")
      .upsert(
        {
          user_id: userId,
          product_id: productId,
          url: link.url,
          meta: (link.meta ?? null) as never,
          saved_at: link.savedAt,
        },
        { onConflict: "user_id,product_id" },
      )
      .then(({ error: migrateError }) => {
        if (migrateError) {
          console.error("[affiliate-store] falha ao migrar link local pro Supabase:", migrateError);
        }
      });
  }
}
