import { DockNavItem } from "./dock-nav-item";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  return (
    <aside className="fixed inset-x-0 bottom-4 z-40 hidden justify-center lg:flex">
      <nav
        className={cn(
          "flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full border border-border/50 bg-surface/60 p-2 shadow-lg backdrop-blur-md",
        )}
      >
        {navigation.map((group, groupIndex) => (
          <div
            key={group.id}
            className={cn(
              "flex items-center gap-1",
              groupIndex > 0 && "ml-2 border-l border-border/40 pl-2",
            )}
          >
            {group.items.map((item) => (
              <DockNavItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
