// Extras comprados além do plano (order bump / upsell), lidos pela RLS
// (cada um só vê os próprios). Cache simples por sessão de página.
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

let cache: { userId: string; kinds: string[] } | null = null;

export function useEntitlements(): string[] {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const [kinds, setKinds] = useState<string[]>(cache && cache.userId === userId ? cache.kinds : []);
  useEffect(() => {
    if (!userId) return;
    if (cache && cache.userId === userId) {
      setKinds(cache.kinds);
      return;
    }
    let cancelled = false;
    void supabase
      .from("user_entitlements" as never)
      .select("kind, revoked_at")
      .then(({ data }) => {
        const list = ((data ?? []) as Array<{ kind: string; revoked_at: string | null }>)
          .filter((r) => !r.revoked_at)
          .map((r) => r.kind);
        cache = { userId, kinds: list };
        if (!cancelled) setKinds(list);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return kinds;
}
