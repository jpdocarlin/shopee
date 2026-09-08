import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_done: boolean;
  // Plano autodeclarado em Configurações — não temos gateway de pagamento
  // integrado, então a pessoa escolhe manualmente qual plano está usando.
  plan: "mensal" | "vitalicio" | null;
};

type AuthState = {
  // true assim que a primeira checagem de sessão (getSession) terminar —
  // evita redirecionar pro /login antes de saber se existe sessão salva.
  initialized: boolean;
  session: Session | null;
  profile: Profile | null;
  // null = ainda não checou; true/false = já sabemos se tem marketplace conectado
  marketplaceConnected: boolean | null;
  // Vem da tabela user_roles (RLS: cada usuário só lê a própria role) — troca
  // o antigo esquema de comparar um e-mail fixo escrito no código do cliente
  // (isso vazava o e-mail do dono no bundle JS público de qualquer visitante).
  isAdmin: boolean;
  // Role restrita "pedidos_admin" (user_roles) — só enxerga a aba Pedidos
  // (Admin); não é o mesmo que isAdmin (dono, vê tudo menos Pedidos Admin).
  isPedidosAdmin: boolean;
  setInitialized: (value: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setMarketplaceConnected: (value: boolean | null) => void;
  setIsAdmin: (value: boolean) => void;
  setIsPedidosAdmin: (value: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  initialized: false,
  session: null,
  profile: null,
  marketplaceConnected: null,
  isAdmin: false,
  isPedidosAdmin: false,
  setInitialized: (value) => set({ initialized: value }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setMarketplaceConnected: (value) => set({ marketplaceConnected: value }),
  setIsAdmin: (value) => set({ isAdmin: value }),
  setIsPedidosAdmin: (value) => set({ isPedidosAdmin: value }),
  reset: () =>
    set({
      session: null,
      profile: null,
      marketplaceConnected: null,
      isAdmin: false,
      isPedidosAdmin: false,
    }),
}));
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  onboarding_done: boolean;
  // Plano autodeclarado em Configurações — não temos gateway de pagamento
  // integrado, então a pessoa escolhe manualmente qual plano está usando.
  plan: "mensal" | "vitalicio" | null;
};

type AuthState = {
  // true assim que a primeira checagem de sessão (getSession) terminar —
  // evita redirecionar pro /login antes de saber se existe sessão salva.
  initialized: boolean;
  session: Session | null;
  profile: Profile | null;
  // null = ainda não checou; true/false = já sabemos se tem marketplace conectado
  marketplaceConnected: boolean | null;
  // Vem da tabela user_roles (RLS: cada usuário só lê a própria role) — troca
  // o antigo esquema de comparar um e-mail fixo escrito no código do cliente
  // (isso vazava o e-mail do dono no bundle JS público de qualquer visitante).
  isAdmin: boolean;
  setInitialized: (value: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setMarketplaceConnected: (value: boolean | null) => void;
  setIsAdmin: (value: boolean) => void;
  reset: () => void;
};

