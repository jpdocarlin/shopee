import { Search } from "lucide-react";

import { Kbd } from "@/components/shared/kbd";
import { useUIStore } from "@/stores/ui-store";

export function GlobalSearchTrigger() {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);

  return (
    <button
      type="button"
      onClick={() => setCommandOpen(true)}
      className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-[13px] text-muted-foreground shadow-soft transition-all duration-200 hover:border-ring/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Search className="size-4 shrink-0 transition-colors group-hover:text-foreground" />
      <span className="truncate">Buscar produtos, pedidos, páginas…</span>
      <span className="ml-auto hidden items-center gap-1 sm:flex">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
