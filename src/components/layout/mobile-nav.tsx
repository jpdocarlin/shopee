import { useState } from "react";
import { GraduationCap, Headset, Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandWordmark } from "./brand-mark";
import { SidebarNavItem } from "./sidebar-nav-item";
import { getNavigationForUser } from "@/config/navigation";
import { useIsOwner, useIsPedidosAdmin } from "@/lib/owner";
import { useEntitlements } from "@/lib/entitlements";
import { useT } from "@/i18n/translations";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const isOwner = useIsOwner();
  const isPedidosAdmin = useIsPedidosAdmin();
  const entitlements = useEntitlements();
  const navigation = getNavigationForUser({ isOwner, isPedidosAdmin, entitlements });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("Abrir menu")}
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[82vw] max-w-[300px] border-border p-0">
        <SheetTitle className="sr-only">{t("Navegação")}</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b border-border px-3">
            <BrandWordmark />
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
            <Link
              to="/membros"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-[13px] font-medium text-foreground"
            >
              <GraduationCap className="size-4 text-brand" /> Aulas
            </Link>
            <Link
              to="/atendimento"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-[13px] font-medium text-foreground"
            >
              <Headset className="size-4 text-brand" /> Ajuda
            </Link>
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
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
