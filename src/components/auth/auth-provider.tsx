import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";

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
      setSession(session);
      setInitialized(true);
      if (session?.user) void loadUserData(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
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
