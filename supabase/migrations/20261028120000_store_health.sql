-- Saúde da loja: contadores diários por anúncio (visitas e vendas acumuladas,
-- como os canais devolvem) e os recaps semanais enviados.
CREATE TABLE IF NOT EXISTS public.listing_daily_stats (
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  total_visits INTEGER,
  total_sales INTEGER,
  photo_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, day)
);
CREATE INDEX IF NOT EXISTS idx_listing_daily_stats_user_day ON public.listing_daily_stats(user_id, day DESC);
ALTER TABLE public.listing_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_daily_stats_select_own ON public.listing_daily_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.weekly_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_recaps_select_own ON public.weekly_recaps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
