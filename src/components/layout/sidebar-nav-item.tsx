import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/translations";

type Props = {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function SidebarNavItem({ item, collapsed, onNavigate }: Props) {
  const Icon = item.icon;
  const t = useT();

  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      activeOptions={{ exact: item.to === "/" }}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors duration-200",
        "hover:bg-surface-hover hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/60",
        collapsed && "justify-center px-0",
      )}
      activeProps={{ className: "bg-surface-hover text-foreground" }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <Icon
            className={cn(
              "size-4 shrink-0 transition-colors",
              isActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          {!collapsed && (
            <>
              <span className="truncate">{t(item.label)}</span>
              {item.badge && (
                <span className="ml-auto rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{t(item.label)}</TooltipContent>
    </Tooltip>
  );
}
