// Área de membros — camada de dados (client-side, RLS resolve o que cada
// usuário enxerga). Mesmo padrão de support.ts/affiliate-links: sem server
// function, porque não existe segredo de servidor envolvido aqui.
//
// Estado de aula/módulo é calculado no cliente a partir de 3 leituras
// simples (módulos, aulas, progresso do próprio usuário) — nada disso
// precisa de SQL fancy porque o catálogo inteiro é pequeno (poucas dezenas
// de aulas, no máximo). Todas as aulas ficam liberadas desde o início (sem
// desbloqueio sequencial) — decisão do Jp em 18/09/2026. O tipo "locked"
// continua existindo em LessonState/ModuleState só por segurança de tipos e
// compatibilidade com o resto do código (StateBadge, redirect na página da
// aula etc.), mas `buildCourseTree` nunca mais atribui esse estado.
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RawCourseModule = Database["public"]["Tables"]["course_modules"]["Row"];
export type RawCourseLesson = Database["public"]["Tables"]["course_lessons"]["Row"];
export type RawLessonProgress = Database["public"]["Tables"]["user_lesson_progress"]["Row"];

export type LessonState = "not_started" | "in_progress" | "completed" | "locked";
export type ModuleState = "available" | "in_progress" | "completed" | "locked";

export type EnrichedLesson = RawCourseLesson & {
  moduleSlug: string;
  moduleTitle: string;
  state: LessonState;
  progressSeconds: number;
  progressRatio: number;
  position: number;
};

export type EnrichedModule = RawCourseModule & {
  lessons: EnrichedLesson[];
  lessonCount: number;
  totalDurationSeconds: number;
  completedCount: number;
  state: ModuleState;
  progressRatio: number;
};

export async function fetchRawCourseData(): Promise<{
  modules: RawCourseModule[];
  lessons: RawCourseLesson[];
  progress: RawLessonProgress[];
}> {
  const [modulesRes, lessonsRes, progressRes] = await Promise.all([
    supabase.from("course_modules").select("*").order("order_index"),
    supabase.from("course_lessons").select("*").order("order_index"),
    supabase.from("user_lesson_progress").select("*"),
  ]);
  if (modulesRes.error) throw modulesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;
  if (progressRes.error) throw progressRes.error;
  return {
    modules: modulesRes.data ?? [],
    lessons: lessonsRes.data ?? [],
    progress: progressRes.data ?? [],
  };
}

export function buildCourseTree(
  modules: RawCourseModule[],
  lessons: RawCourseLesson[],
  progress: RawLessonProgress[],
): EnrichedModule[] {
  const progressByLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  const sortedModules = [...modules].sort((a, b) => a.order_index - b.order_index);

  const lessonsByModule = new Map<string, RawCourseLesson[]>();
  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }
  for (const list of lessonsByModule.values()) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  let position = 0;

  return sortedModules.map((module) => {
    const rawLessons = lessonsByModule.get(module.id) ?? [];
    const enrichedLessons: EnrichedLesson[] = rawLessons.map((lesson) => {
      position += 1;
      const p = progressByLesson.get(lesson.id);
      const completed = p?.completed ?? false;
      const progressSeconds = p?.progress_seconds ?? 0;
      // Todas as aulas liberadas desde o início — sem gate sequencial.
      const state: LessonState = completed
        ? "completed"
        : progressSeconds > 0
          ? "in_progress"
          : "not_started";

      return {
        ...lesson,
        moduleSlug: module.slug,
        moduleTitle: module.title,
        state,
        progressSeconds,
        progressRatio:
          lesson.duration_seconds > 0 ? Math.min(1, progressSeconds / lesson.duration_seconds) : 0,
        position,
      };
    });

    const lessonCount = enrichedLessons.length;
    const completedCount = enrichedLessons.filter((l) => l.state === "completed").length;
    const totalDurationSeconds = enrichedLessons.reduce((sum, l) => sum + l.duration_seconds, 0);
    const hasInProgress = enrichedLessons.some((l) => l.state === "in_progress");

    // Sem gate sequencial: módulo nunca fica "locked", só reflete progresso.
    const moduleState: ModuleState =
      lessonCount > 0 && completedCount === lessonCount
        ? "completed"
        : completedCount > 0 || hasInProgress
          ? "in_progress"
          : "available";

    return {
      ...module,
      lessons: enrichedLessons,
      lessonCount,
      totalDurationSeconds,
      completedCount,
      state: moduleState,
      progressRatio: lessonCount > 0 ? completedCount / lessonCount : 0,
    };
  });
}

// Fração do vídeo a partir da qual consideramos a aula concluída — evita
// exigir assistir literalmente até o último frame (créditos, tela final etc).
export const LESSON_COMPLETE_THRESHOLD = 0.9;

export async function saveLessonProgress(params: {
  userId: string;
  lessonId: string;
  progressSeconds: number;
  completed: boolean;
}): Promise<void> {
  const { error } = await supabase.from("user_lesson_progress").upsert(
    {
      user_id: params.userId,
      lesson_id: params.lessonId,
      progress_seconds: Math.max(0, Math.floor(params.progressSeconds)),
      completed: params.completed,
      completed_at: params.completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) {
    console.error("[membros] falha ao salvar progresso da aula:", error);
  }
}

export function formatDurationShort(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  return `${minutes}min`;
}

export function formatClockTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const COURSE_TREE_QUERY_KEY = ["membros", "course-tree"] as const;

// Hook compartilhado — layout (command palette) e as 3 páginas da área de
// membros chamam isso independentemente; o React Query dedupe/cacheia pela
// mesma queryKey, então só existe uma leitura de rede de verdade por vez.
export function useCourseTree() {
  return useQuery({
    queryKey: COURSE_TREE_QUERY_KEY,
    queryFn: async () => {
      const { modules, lessons, progress } = await fetchRawCourseData();
      return buildCourseTree(modules, lessons, progress);
    },
    staleTime: 15_000,
  });
}
