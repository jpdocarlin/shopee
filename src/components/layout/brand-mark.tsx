import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-[10px] border border-border bg-gradient-to-b from-brand/90 to-brand/60 text-brand-foreground shadow-soft",
        className,
      )}
      aria-hidden
    >
      <span className="text-[15px] font-bold leading-none">S</span>
    </span>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <BrandMark />
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Shoppfy</span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">Affiliate OS</span>
        </div>
      )}
    </div>
  );
}
