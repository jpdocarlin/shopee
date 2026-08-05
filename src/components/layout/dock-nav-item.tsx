import { Link } from "@tanstack/react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItem } from "@/config/navigation";
import { useT } from "@/i18n/translations";

export function DockNavItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const t = useT();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          aria-label={t(item.label)}
          className="group relative flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 outline-none transition-colors duration-200 hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          activeProps={{ className: "bg-brand/15 text-brand hover:bg-brand/20 hover:text-brand" }}
        >
          <Icon className="size-[18px]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={10}>
        {t(item.label)}
      </TooltipContent>
    </Tooltip>
  );
}
