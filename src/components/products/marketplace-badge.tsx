import { MARKETPLACE_META } from "@/data/demo-products";
import { cn } from "@/lib/utils";

type Props = {
  marketplace: keyof typeof MARKETPLACE_META;
  className?: string;
};

export function MarketplaceBadge({ marketplace, className }: Props) {
  const meta = MARKETPLACE_META[marketplace];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground backdrop-blur",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}
