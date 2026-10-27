-- Meus anúncios: cada anúncio do cliente na Shopee / Mercado Livre.
-- Gravado ao publicar pelo Criar Anúncio e também importado da loja
-- ("Atualizar da loja"). É a base da pausa automática sem estoque, da
-- revisão de preços e da importação de pedidos.
-- O cliente só LÊ os próprios anúncios; quem grava é o servidor (service
-- role), depois de conferir na API do canal.
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee', 'mercado-livre')),
  external_id TEXT NOT NULL,
  product_id TEXT,
  title TEXT NOT NULL,
  image_url TEXT,
  permalink TEXT,
  price_cents INTEGER NOT NULL,
  cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  paused_by_system BOOLEAN NOT NULL DEFAULT false,
  pause_reason TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (marketplace, external_id)
);
CREATE INDEX IF NOT EXISTS idx_listings_user ON public.listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_product ON public.listings(product_id);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listings_select_own ON public.listings;
CREATE POLICY listings_select_own ON public.listings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
