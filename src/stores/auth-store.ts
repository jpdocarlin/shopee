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
  setInitialized: (value: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setMarketplaceConnected: (value: boolean | null) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  initialized: false,
  session: null,
  profile: null,
  marketplaceConnected: null,
  setInitialized: (value) => set({ initialized: value }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setMarketplaceConnected: (value) => set({ marketplaceConnected: value }),
  reset: () => set({ session: null, profile: null, marketplaceConnected: null }),
}));
