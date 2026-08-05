import { Bell } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";

export function NotificationsMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative rounded-md p-2 text-muted-foreground transition-colors duration-200 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13px] font-medium text-foreground">Notificações</p>
        </div>
        <EmptyState
          icon={Bell}
          title="Tudo em dia"
          description="Alertas de preço, comissões e pedidos aparecem aqui."
          className="border-0 py-8"
        />
      </PopoverContent>
    </Popover>
  );
}