// Escuta em tempo real quando um código de rastreio chega num pedido do
// usuário logado (Supabase Realtime) e dispara: (1) toast na hora, (2) uma
// notificação persistida no sininho do header. Deve ser montado uma única
// vez perto da raiz do app (ver AppShell), igual o useExtensionBridge.
import { useEffect } from "react";
import { toast } from "sonner";

import { subscribeToTrackingUpdates } from "@/lib/fulfillment";
import { useAuthStore } from "@/stores/auth-store";
import { useTrackingNotificationsStore } from "@/stores/tracking-notifications-store";

export function useTrackingNotifications() {
  const userId = useAuthStore((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToTrackingUpdates(userId, (request) => {
      if (!request.tracking_code) return;

      useTrackingNotificationsStore.getState().add({
        id: crypto.randomUUID(),
        requestId: request.id,
        productName: request.product_name,
        trackingCode: request.tracking_code,
        createdAt: new Date().toISOString(),
      });

      toast.success("Código de rastreio chegou", {
        description: `${request.product_name} · ${request.tracking_code}`,
      });
    });

    return unsubscribe;
  }, [userId]);
}
