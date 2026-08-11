import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DemoProduct } from "@/data/demo-products";

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
};

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
      saveLink: (productId, url, meta) =>
        set((state) => ({
          links: {
            ...state.links,
            [productId]: { url: url.trim(), savedAt: new Date().toISOString(), meta },
          },
        })),
      removeLink: (productId) =>
        set((state) => {
          const next = { ...state.links };
          delete next[productId];
          return { links: next };
        }),
      getLink: (productId) => get().links[productId],
      hasAnyLink: () => Object.keys(get().links).length > 0,
      // Zera ao trocar de usuário no mesmo navegador, pra links salvos de uma
      // conta nunca vazarem pra outra.
      reset: () => set({ registered: {}, links: {} }),
    }),
    { name: "shoppfy.affiliate" },
  ),
);
