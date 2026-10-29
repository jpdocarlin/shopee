-- Guarda o 1º texto (título/descrição) gerado por cliente+produto+canal, pra
-- não pagar a IA de novo quando a pessoa volta no mesmo produto. "Gerar outra
-- versão" sempre gera um texto novo. Só o servidor (service role) lê/grava.
CREATE TABLE IF NOT EXISTS public.listing_text_cache (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  product_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, marketplace, product_key)
);
ALTER TABLE public.listing_text_cache ENABLE ROW LEVEL SECURITY;
