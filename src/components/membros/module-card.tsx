import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDurationShort, type EnrichedModule } from "@/lib/membros";
import { ProgressBar } from "./progress-bar";
import { StateBadge } from "./state-badge";
import { useCardGlow } from "./use-card-glow";

export function ModuleCard({ module, featured }: { module: EnrichedModule; featured?: boolean }) {
  const onMouseMove = useCardGlow();
  const number = String(module.order_index + 1).padStart(2, "0");
  const locked = module.state === "locked";

  const inner = (
    <>
      <div className="mb-card-glow" />
      <span
        className="mb-card-number select-none"
        style={{ fontSize: featured ? "10rem" : "6.5rem" }}
        aria-hidden
      >
        {number}
      </span>

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-3">
          <span className="mb-eyebrow">Módulo {number}</span>
          <StateBadge state={module.state} kind="module" />
        </div>

        <div>
          <h3
            className={cn(
              "mb-heading",
              featured ? "text-[28px] sm:text-[34px]" : "text-[19px] sm:text-[21px]",
            )}
          >
            {module.title}
          </h3>
          <p
            className={cn(
              "mt-2 mb-body-muted",
              featured ? "max-w-md text-[14px]" : "text-[13px] line-clamp-2",
            )}
          >
            {module.description}
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[12px] mb-body-muted">
            <span>
              {module.lessonCount} {module.lessonCount === 1 ? "aula" : "aulas"} ·{" "}
              {formatDurationShort(module.totalDurationSeconds)}
            </span>
            <span className="tabular-nums">{Math.round(module.progressRatio * 100)}%</span>
          </div>
          <ProgressBar value={module.progressRatio} />
        </div>
      </div>

      {locked && (
        <div className="absolute right-5 top-5 grid size-8 place-items-center rounded-full border border-[var(--mb-border)] bg-black/40 text-[var(--mb-text-faint)]">
          <Lock className="size-3.5" />
        </div>
      )}
    </>
  );

  const className = cn(
    "mb-card group relative block p-6 sm:p-7",
    featured && "sm:col-span-2 sm:row-span-2 sm:p-10",
    locked ? "cursor-not-allowed opacity-60" : "is-active",
  );

  if (locked) {
    return (
      <div className={className} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to="/membros/$moduloSlug"
      params={{ moduloSlug: module.slug }}
      onMouseMove={onMouseMove}
      className={className}
    >
      {inner}
    </Link>
  );
}
