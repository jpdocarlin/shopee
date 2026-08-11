import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useDemoBoostStore } from "@/stores/demo-boost-store";

// Marca, no navegador, qual foi o último usuário logado — usado só pra saber
// quando trocou de conta (não guarda nada sensível, é só um id).
const LAST_USER_ID_KEY = "shoppfy.last-user-id";

// Stores locais que guardam dado real do usuário (links salvos, favoritos,
// nome de exibição). Nenhuma delas é vinculada ao id do Supabase — são só
// chaves globais no localStorage — então, sem essa limpeza, um segundo
// usuário no mesmo navegador herdaria os dados do usuário anterior.
function clearPerUserStores() {
  useAffiliateStore.getState().reset();
  useFavoritesStore.getState().reset();
  useProfileStore.getState().reset();
  useDemoBoostStore.getState().reset();
}

// Sempre que o id do usuário logado for diferente do último visto (incluindo
// virar null no logout), zera os stores locais antes de carregar os dados da
// conta nova — garante que cada conta começa "zerada", como usuário novo.
function syncUserScopedStorage(userId: string | null) {
  const lastUserId = localStorage.getItem(LAST_USER_ID_KEY);
  if (lastUserId === userId) return;
  clearPerUserStores();
  if (userId) {
    localStorage.setItem(LAST_USER_ID_KEY, userId);
  } else {
    localStorage.removeItem(LAST_USER_ID_KEY);
  }
}

// Monta uma única vez no root do app. Sincroniza a sessão do Supabase com o
// auth-store (zustand) e, sempre que a sessão mudar, recarrega o perfil e o
// status de conexão de marketplace (para o cadeado global de "conta conectada").
export function AuthProvider() {
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setMarketplaceConnected = useAuthStore((s) => s.setMarketplaceConnected);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData(userId: string) {
      const [{ data: profile }, { data: accounts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, onboarding_done")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("marketplace_accounts").select("id").limit(1),
      ]);

      if (cancelled) return;
      setProfile(profile ?? null);
      setMarketplaceConnected((accounts?.length ?? 0) > 0);
      if (profile?.full_name) useProfileStore.getState().setName(profile.full_name);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      syncUserScopedStorage(session?.user?.id ?? null);
      setSession(session);
      setInitialized(true);
      if (session?.user) void loadUserData(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      syncUserScopedStorage(session?.user?.id ?? null);
      setSession(session);
      setInitialized(true);
      if (session?.user) {
        void loadUserData(session.user.id);
      } else {
        reset();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
