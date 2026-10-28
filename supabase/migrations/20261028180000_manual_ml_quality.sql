-- Qualidade de anúncios do Mercado Livre informada à mão (conta do dono, cuja
-- loja de ML não está conectada). Quando existe, substitui a lista da API.
CREATE TABLE IF NOT EXISTS public.manual_ml_quality (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  actions TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.manual_ml_quality ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_ml_quality_select_own ON public.manual_ml_quality
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
