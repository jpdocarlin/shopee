import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { Thumbnail } from "@/components/membros/thumbnail";
import { VideoPlayer } from "@/components/membros/video-player";
import { StateBadge } from "@/components/membros/state-badge";
import { Reveal } from "@/components/motion/reveal";
import { useAuthStore } from "@/stores/auth-store";
import {
  COURSE_TREE_QUERY_KEY,
  LESSON_COMPLETE_THRESHOLD,
  formatClockTime,
  formatDurationShort,
  saveLessonProgress,
  useCourseTree,
  type EnrichedLesson,
} from "@/lib/membros";

export const Route = createFileRoute("/membros/$moduloSlug/$aulaSlug")({
  component: LessonPage,
});

function LessonPage() {
  const { moduloSlug, aulaSlug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: modules, isLoading } = useCourseTree();
  const currentModule = modules?.find((m) => m.slug === moduloSlug);
  const lesson = currentModule?.lessons.find((l) => l.slug === aulaSlug);

  const flatLessons = modules?.flatMap((m) => m.lessons) ?? [];
  const flatIndex = lesson ? flatLessons.findIndex((l) => l.id === lesson.id) : -1;
  const previousLesson: EnrichedLesson | undefined =
    flatIndex > 0 ? flatLessons[flatIndex - 1] : undefined;
  const nextLesson: EnrichedLesson | undefined =
    flatIndex >= 0 && flatIndex < flatLessons.length - 1 ? flatLessons[flatIndex + 1] : undefined;

  const [justCompleted, setJustCompleted] = useState(false);
  const hasCompletedRef = useRef(false);
  hasCompletedRef.current = lesson?.state === "completed";

  // Aula inexistente, ou bloqueada (usuário chegou direto pela URL sem ter
  // concluído a anterior) — volta pro módulo em vez de deixar o player
  // quebrado ou vazando conteúdo fora de ordem.
  useEffect(() => {
    if (!modules) return;
    if (!currentModule || !lesson) {
      void navigate({ to: "/membros" });
      return;
    }
    if (lesson.state === "locked") {
      void navigate({ to: "/membros/$moduloSlug", params: { moduloSlug } });
    }
  }, [modules, currentModule, lesson, moduloSlug, navigate]);

  function persist(seconds: number, duration: number, forceCompleted?: boolean) {
    if (!userId || !lesson) return;
    const ratio = duration > 0 ? seconds / duration : 0;
    const completed =
      forceCompleted ?? hasCompletedRef.current ?? ratio >= LESSON_COMPLETE_THRESHOLD;
    const becameCompleted = completed && !hasCompletedRef.current;
    hasCompletedRef.current = completed;
    void saveLessonProgress({
      userId,
      lessonId: lesson.id,
      progressSeconds: seconds,
      completed,
    }).then(() => {
      if (becameCompleted) {
        setJustCompleted(true);
        void queryClient.invalidateQueries({ queryKey: COURSE_TREE_QUERY_KEY });
      }
    });
  }

  if (isLoading || !currentModule || !lesson) {
    return <div className="mx-auto max-w-3xl px-5 pt-10 sm:px-8 sm:pt-14" />;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8 sm:pt-14">
      <Link
        to="/membros/$moduloSlug"
        params={{ moduloSlug }}
        className="mb-body-muted inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[var(--mb-text)]"
      >
        <ArrowLeft className="size-3.5" />
        Voltar pro módulo
      </Link>

      <Reveal variant="up" className="mb-6 mt-6">
        <p className="mb-eyebrow">{currentModule.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="mb-heading text-[24px] sm:text-[30px]">{lesson.title}</h1>
          <StateBadge state={justCompleted ? "completed" : lesson.state} kind="lesson" />
        </div>
      </Reveal>

      <Reveal variant="fade" delay={0.08}>
        <VideoPlayer
          key={lesson.id}
          videoUrl={lesson.video_url}
          initialSeconds={lesson.progressSeconds}
          onProgress={(seconds, duration) => persist(seconds, duration)}
          onEnded={() => {
            if (lesson) persist(lesson.duration_seconds || 0, lesson.duration_seconds || 0, true);
          }}
        />
      </Reveal>

      <Reveal
        variant="up"
        delay={0.12}
        className="mt-6 flex items-center justify-between text-[12px] mb-body-muted"
      >
        <span>{formatClockTime(lesson.duration_seconds)}</span>
        {lesson.state === "completed" || justCompleted ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--mb-success)]">
            <CheckCircle2 className="size-3.5" />
            Aula concluída
          </span>
        ) : null}
      </Reveal>

      {lesson.description && (
        <Reveal variant="up" delay={0.16} className="mt-5">
          <p className="text-[14px] leading-relaxed mb-body-muted">{lesson.description}</p>
        </Reveal>
      )}

      {/* Navegação rápida entre aulas */}
      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--mb-border)] pt-6">
        {previousLesson ? (
          <Link
            to="/membros/$moduloSlug/$aulaSlug"
            params={{ moduloSlug: previousLesson.moduleSlug, aulaSlug: previousLesson.slug }}
            className="mb-btn-ghost"
          >
            <ArrowLeft className="size-3.5" />
            Aula anterior
          </Link>
        ) : (
          <span />
        )}
        {nextLesson ? (
          <Link
            to="/membros/$moduloSlug/$aulaSlug"
            params={{ moduloSlug: nextLesson.moduleSlug, aulaSlug: nextLesson.slug }}
            className={cn_ghost(nextLesson.state === "locked")}
            aria-disabled={nextLesson.state === "locked"}
            onClick={(e) => {
              if (nextLesson.state === "locked") e.preventDefault();
            }}
          >
            Próxima aula
            <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Card de próxima aula — só aparece com destaque quando essa foi
          concluída, matching a spec de "ao final, próxima aula". */}
      {nextLesson && (justCompleted || lesson.state === "completed") && (
        <Reveal variant="up" className="mt-6">
          <Link
            to="/membros/$moduloSlug/$aulaSlug"
            params={{ moduloSlug: nextLesson.moduleSlug, aulaSlug: nextLesson.slug }}
            className="mb-card group flex items-center gap-4 p-4"
          >
            <Thumbnail
              number={String(nextLesson.order_index + 1).padStart(2, "0")}
              state={nextLesson.state}
              className="w-28 shrink-0 sm:w-32"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-eyebrow">Próxima aula</p>
              <p className="mt-1 truncate text-[15px] font-medium text-[var(--mb-text)]">
                {nextLesson.title}
              </p>
              <p className="mt-1 text-[12px] mb-body-muted">
                {formatDurationShort(nextLesson.duration_seconds)}
              </p>
            </div>
            <span className="mb-btn-primary shrink-0">
              Continuar
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </Reveal>
      )}

      {!nextLesson && (justCompleted || lesson.state === "completed") && (
        <Reveal variant="up" className="mb-card mt-6 flex items-center gap-3 p-5">
          <CheckCircle2 className="size-5 shrink-0 text-[var(--mb-success)]" />
          <p className="text-[13.5px] text-[var(--mb-text)]">
            Você concluiu todas as aulas disponíveis. 🎉
          </p>
        </Reveal>
      )}
    </div>
  );
}

function cn_ghost(disabled: boolean) {
  return disabled ? "mb-btn-ghost pointer-events-none opacity-40" : "mb-btn-ghost";
}
