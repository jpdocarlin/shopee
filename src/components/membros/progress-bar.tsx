import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  thin,
  className,
}: {
  value: number;
  thin?: boolean;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cn("mb-progress-track", thin && "h-[3px]", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="mb-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
