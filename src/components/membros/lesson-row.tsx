import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatClockTime, type EnrichedLesson } from "@/lib/membros";
import { ProgressBar } from "./progress-bar";
import { Thumbnail } from "./thumbnail";

function StatusIcon({ state }: { state: EnrichedLesson["state"] }) {
  if (state === "completed")
    return <CheckCircle2 className="size-[18px] text-[var(--mb-success)]" />;
  if (state === "in_progress")
    return <PlayCircle className="size-[18px] text-[var(--mb-orange)]" />;
  if (state === "locked") return <Lock className="size-[15px] text-[var(--mb-text-faint)]" />;
  return <Circle className="size-[15px] text-[var(--mb-text-faint)]" />;
}

export function LessonRow({ lesson }: { lesson: EnrichedLesson }) {
  const locked = lesson.state === "locked";
  const number = String(lesson.order_index + 1).padStart(2, "0");

  const content = (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[var(--mb-radius-md)] border border-transparent p-3 transition-colors duration-200",
        !locked && "hover:border-[var(--mb-border)] hover:bg-white/[0.025]",
        lesson.state === "in_progress" &&
          "border-[var(--mb-border-active)] bg-[var(--mb-orange-dim)] hover:border-[var(--mb-border-active)]",
      )}
    >
      <Thumbnail number={number} state={lesson.state} className="w-28 shrink-0 sm:w-36" />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[14px] font-medium",
            locked ? "text-[var(--mb-text-faint)]" : "text-[var(--mb-text)]",
          )}
        >
          {lesson.title}
        </p>
        <p className="mt-1 text-[12px] mb-body-muted">
          {formatClockTime(lesson.duration_seconds)}
          {lesson.state === "in_progress" && " · continuar de onde parou"}
        </p>
        {lesson.state === "in_progress" && (
          <div className="mt-2 max-w-[180px]">
            <ProgressBar value={lesson.progressRatio} thin />
          </div>
        )}
      </div>

      <StatusIcon state={lesson.state} />
    </div>
  );

  if (locked) {
    return (
      <div aria-disabled className="cursor-not-allowed">
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/membros/$moduloSlug/$aulaSlug"
      params={{ moduloSlug: lesson.moduleSlug, aulaSlug: lesson.slug }}
    >
      {content}
    </Link>
  );
}
