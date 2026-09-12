-- =========================================================
-- ÁREA DE MEMBROS · módulos, aulas e progresso por usuário
-- =========================================================
-- Escopo bem restrito a pedido do Jp: só módulos + aulas (sem dashboard,
-- XP, gamificação, comunidade, loja etc.). Conteúdo é sobre revenda usando
-- produtos do fornecedor (não é mais "afiliado"), sem nenhuma etapa de IA
-- ou vídeo gerado — ver decisões registradas no Obsidian (12/09/2026).
--
-- Sem vídeo/thumbnail reais ainda (o Jp não gravou nenhuma aula até agora):
-- video_url e thumbnail_url ficam NULL por enquanto. O player/thumbnail no
-- frontend tratam isso com um estado "em produção" elegante em vez de
-- quebrado — nada aqui depende de asset nenhum pra já ficar no ar.

CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_modules_order ON public.course_modules(order_index);

GRANT SELECT ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_modules_select_published" ON public.course_modules
  FOR SELECT TO authenticated USING (is_published = true);

CREATE TRIGGER trg_course_modules_updated
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- course_lessons ----------
CREATE TABLE public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  -- URL direta do vídeo (mp4). NULL até o Jp gravar e a gente apontar pra
  -- onde o arquivo for hospedado — sem storage/bucket criado ainda, de
  -- propósito (não faz sentido montar infra de upload antes de existir
  -- conteúdo real pra subir).
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);
CREATE INDEX idx_course_lessons_module_order ON public.course_lessons(module_id, order_index);

GRANT SELECT ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_lessons_select_published" ON public.course_lessons
  FOR SELECT TO authenticated USING (is_published = true);

CREATE TRIGGER trg_course_lessons_updated
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- user_lesson_progress ----------
-- Uma linha por (usuário, aula). progress_seconds alimenta a barra de
-- progresso dentro da aula; completed decide o estado "concluída" nas
-- listas/módulos e o desbloqueio sequencial da próxima aula.
CREATE TABLE public.user_lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX idx_user_lesson_progress_user ON public.user_lesson_progress(user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_lesson_progress TO authenticated;
GRANT ALL ON public.user_lesson_progress TO service_role;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_lesson_progress_select_own" ON public.user_lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_lesson_progress_insert_own" ON public.user_lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_lesson_progress_update_own" ON public.user_lesson_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_lesson_progress_updated
  BEFORE UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
