import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import { LessonRow } from "@/components/membros/lesson-row";
import { LessonRowSkeleton } from "@/components/membros/skeletons";
import { ProgressBar } from "@/components/membros/progress-bar";
import { StateBadge } from "@/components/membros/state-badge";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { formatDurationShort, useCourseTree } from "@/lib/membros";

export const Route = createFileRoute("/membros/$moduloSlug")({
  component: ModulePage,
});

function ModulePage() {
  const { moduloSlug } = Route.useParams();
  const navigate = useNavigate();
  const { data: modules, isLoading } = useCourseTree();
  const currentModule = modules?.find((m) => m.slug === moduloSlug);

  // Módulo não existe ou (por alguma mudança de estado) ficou bloqueado —
  // volta pra home da área de membros em vez de mostrar uma tela quebrada.
  useEffect(() => {
    if (modules && !currentModule) {
      void navigate({ to: "/membros" });
    }
  }, [modules, currentModule, navigate]);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <Link
        to="/membros"
        className="mb-body-muted inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[var(--mb-text)]"
      >
        <ArrowLeft className="size-3.5" />
        Todos os módulos
      </Link>

      {isLoading && (
        <div className="mt-8 space-y-3">
          <LessonRowSkeleton />
          <LessonRowSkeleton />
          <LessonRowSkeleton />
        </div>
      )}

      {currentModule && (
        <>
          <Reveal variant="up" className="mb-10 mt-6 sm:mb-12">
            <div className="flex items-center gap-2.5">
              <span className="mb-eyebrow">
                Módulo {String(currentModule.order_index + 1).padStart(2, "0")}
              </span>
              <StateBadge state={currentModule.state} kind="module" />
            </div>
            <h1 className="mb-heading mt-3 text-[28px] sm:text-[34px]">{currentModule.title}</h1>
            <p className="mt-2 max-w-lg text-[14px] mb-body-muted">{currentModule.description}</p>

            <div className="mt-6 max-w-xs space-y-2">
              <div className="flex items-center justify-between text-[12px] mb-body-muted">
                <span>
                  {currentModule.lessonCount} aulas ·{" "}
                  {formatDurationShort(currentModule.totalDurationSeconds)}
                </span>
                <span className="tabular-nums">
                  {Math.round(currentModule.progressRatio * 100)}%
                </span>
              </div>
              <ProgressBar value={currentModule.progressRatio} />
            </div>
          </Reveal>

          <Stagger className="space-y-2" stagger={0.05}>
            {currentModule.lessons.map((lesson) => (
              <StaggerItem key={lesson.id}>
                <LessonRow lesson={lesson} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
