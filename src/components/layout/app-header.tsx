import { Link } from "@tanstack/react-router";
import { Headset } from "lucide-react";

import { BrandMark } from "./brand-mark";
import { GlobalSearchTrigger } from "./global-search-trigger";
import { MobileNav } from "./mobile-nav";
import { NotificationsMenu } from "./notifications-menu";
import { SaleDemoButton } from "./sale-demo-button";
import { UserMenu } from "./user-menu";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-xl md:px-5">
      <MobileNav />
      <Link to="/" aria-label="Shoppfy">
        <BrandMark />
      </Link>

      <div className="flex flex-1 justify-center px-2 md:justify-start">
        <GlobalSearchTrigger />
      </div>

      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className="hidden h-7 gap-1.5 border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground sm:flex"
        >
          <span className="size-1.5 rounded-full bg-brand" />
          Plano Pro
        </Badge>
        <a
          href="https://atendimento.shoppfy.online"
          target="_blank"
          rel="noopener noreferrer"
          title="Atendimento"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Headset className="size-4" />
        </a>
        <SaleDemoButton />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
