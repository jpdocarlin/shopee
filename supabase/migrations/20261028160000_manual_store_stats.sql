-- Números informados à mão pelo dono (lojas que ele opera e que não estão
-- conectadas na Shoppfy). Quando existe linha pro período (7 ou 30 dias),
-- substitui visitas e vendas calculadas daquele canal — só na conta dele.
CREATE TABLE IF NOT EXISTS public.manual_store_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee', 'mercado-livre')),
  period_days INTEGER NOT NULL CHECK (period_days IN (7, 30)),
  visits INTEGER,
  orders INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, marketplace, period_days)
);
ALTER TABLE public.manual_store_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_store_stats_select_own ON public.manual_store_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
