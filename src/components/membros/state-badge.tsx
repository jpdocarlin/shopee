import { cn } from "@/lib/utils";
import type { LessonState, ModuleState } from "@/lib/membros";

const MODULE_LABEL: Record<ModuleState, string> = {
  available: "Disponível",
  in_progress: "Em andamento",
  completed: "Concluído",
  locked: "Bloqueado",
};

const LESSON_LABEL: Record<LessonState, string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  completed: "Concluída",
  locked: "Bloqueada",
};

export function StateBadge({
  state,
  kind,
  className,
}: {
  state: ModuleState | LessonState;
  kind: "module" | "lesson";
  className?: string;
}) {
  const label =
    kind === "module" ? MODULE_LABEL[state as ModuleState] : LESSON_LABEL[state as LessonState];
  return (
    <span
      className={cn(
        "mb-badge",
        state === "completed" && "is-done",
        state === "in_progress" && "is-active",
        className,
      )}
    >
      {label}
    </span>
  );
}
