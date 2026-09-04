// Notificações de código de rastreio recebido. Vive só na sessão (em
// memória) — não precisa persistir entre recarregamentos, já que o próprio
// pedido (com o código) continua salvo e visível na página Pedidos.
import { create } from "zustand";

export type TrackingNotification = {
  id: string;
  requestId: string;
  productName: string;
  trackingCode: string;
  createdAt: string;
  read: boolean;
};

type TrackingNotificationsState = {
  notifications: TrackingNotification[];
  add: (notification: Omit<TrackingNotification, "read">) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useTrackingNotificationsStore = create<TrackingNotificationsState>((set) => ({
  notifications: [],
  add: (notification) =>
    set((state) => ({
      notifications: [{ ...notification, read: false }, ...state.notifications].slice(0, 30),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clear: () => set({ notifications: [] }),
}));
