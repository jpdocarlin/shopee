import { useState } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandWordmark } from "./brand-mark";
import { SidebarNavItem } from "./sidebar-nav-item";
import { navigation } from "@/config/navigation";
import { useT } from "@/i18n/translations";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("Abrir menu")}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
        >
          <Menu className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[248px] border-border p-0">
        <SheetTitle className="sr-only">{t("Navegação")}</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b border-border px-3">
            <BrandWordmark />
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {navigation.map((group) => (
              <div key={group.id} className="space-y-1">
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/70">
                  {t(group.label)}
                </p>
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.to}
                    item={item}
                    collapsed={false}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
