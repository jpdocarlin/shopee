-- Visitas da LOJA inteira (todos os anúncios da Shopee, não só os da Shoppfy).
-- A Shopee só devolve o contador acumulado de visualizações de cada anúncio,
-- então guardamos a soma da loja uma vez por dia e o período é a diferença.
CREATE TABLE IF NOT EXISTS public.store_daily_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee', 'mercado-livre')),
  day DATE NOT NULL,
  total_views BIGINT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, marketplace, day)
);
ALTER TABLE public.store_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_daily_stats_select_own ON public.store_daily_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
