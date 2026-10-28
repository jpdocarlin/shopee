import { useEffect, useState } from "react";

import { AppNotificationsCard } from "@/components/notifications/app-notifications-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

// Convite pra colocar o Shoppfy no celular: aparece uma única vez, logo
// depois do primeiro login. Fica marcado na própria conta (user_metadata),
// então não volta a aparecer nem em outro aparelho.
const SEEN_FLAG = "app_install_prompt_seen";
const localKey = (userId: string) => `shoppfy:app-install-seen:${userId}`;

export function AppInstallWelcome() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [open, setOpen] = useState(false);

  const user = session?.user;
  useEffect(() => {
    if (!user || !profile?.onboarding_done) return;
    if (user.user_metadata?.[SEEN_FLAG]) return;
    try {
      if (localStorage.getItem(localKey(user.id))) return;
    } catch {
      // sem storage: segue só com a marcação da conta
    }
    setOpen(true);
  }, [user, profile?.onboarding_done]);

  const markSeen = () => {
    setOpen(false);
    if (!user) return;
    try {
      localStorage.setItem(localKey(user.id), "1");
    } catch {
      // ok
    }
    void supabase.auth.updateUser({ data: { [SEEN_FLAG]: true } }).catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? markSeen() : setOpen(true))}>
      <DialogContent className="border-border bg-popover sm:max-w-2xl">
        <DialogTitle className="sr-only">Shoppfy no celular</DialogTitle>
        <AppNotificationsCard variant="modal" />
        <div className="flex justify-end">
          <Button variant="outline" onClick={markSeen}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
