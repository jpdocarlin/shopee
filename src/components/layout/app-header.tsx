import { Link } from "@tanstack/react-router";
import { GraduationCap, Headset } from "lucide-react";

import { BrandMark } from "./brand-mark";
import { GlobalSearchTrigger } from "./global-search-trigger";
import { MobileNav } from "./mobile-nav";
import { NotificationsMenu } from "./notifications-menu";
import { SaleDemoButton } from "./sale-demo-button";
import { UserMenu } from "./user-menu";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-background/80 px-2 backdrop-blur-xl sm:gap-3 md:px-5">
      <MobileNav />
      <Link to="/" aria-label="Shoppfy">
        <BrandMark />
      </Link>

      <div className="flex min-w-0 flex-1 justify-end px-1 sm:justify-center sm:px-2 md:justify-start">
        <GlobalSearchTrigger />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <Badge
          variant="outline"
          className="hidden h-7 gap-1.5 border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground sm:flex"
        >
          <span className="size-1.5 rounded-full bg-brand" />
          Plano Pro
        </Badge>
        <Link
          to="/membros"
          title="Aulas"
          aria-label="Aulas"
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:size-8"
        >
          <GraduationCap className="size-[18px] sm:size-4" />
        </Link>
        {/* Mesmo domínio: o cliente já está logado (outro domínio pedia login de novo). */}
        <Link
          to="/atendimento"
          title="Atendimento"
          aria-label="Atendimento"
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:size-8"
        >
          <Headset className="size-[18px] sm:size-4" />
        </Link>
        <div className="hidden sm:block">
          <SaleDemoButton />
        </div>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
