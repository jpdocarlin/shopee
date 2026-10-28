-- Tarefas da semana da Saúde da loja (geradas uma vez por semana, a pessoa
-- vai marcando como feitas).
CREATE TABLE IF NOT EXISTS public.weekly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  link TEXT,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, task_key)
);
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_tasks_select_own ON public.weekly_tasks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
