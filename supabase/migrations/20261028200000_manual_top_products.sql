-- Ranking de mais vendidos informado à mão (lojas do dono não conectadas).
CREATE TABLE IF NOT EXISTS public.manual_top_products (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee', 'mercado-livre')),
  period_days INTEGER NOT NULL CHECK (period_days IN (7, 30)),
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, marketplace, period_days, position)
);
ALTER TABLE public.manual_top_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_top_products_select_own ON public.manual_top_products
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
