import { Bell, PackageCheck } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { useTrackingNotificationsStore } from "@/stores/tracking-notifications-store";

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationsMenu() {
  const notifications = useTrackingNotificationsStore((s) => s.notifications);
  const markAllRead = useTrackingNotificationsStore((s) => s.markAllRead);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover onOpenChange={(open) => open && unreadCount > 0 && markAllRead()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative rounded-md p-2 text-muted-foreground transition-colors duration-200 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13px] font-medium text-foreground">Notificações</p>
        </div>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Tudo em dia"
            description="Alertas de preço, comissões e pedidos aparecem aqui."
            className="border-0 py-8"
          />
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2.5 px-4 py-3">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground">
                    Código de rastreio chegou
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{n.productName}</p>
                  <p className="mt-0.5 text-[11.5px] font-medium text-brand">{n.trackingCode}</p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
