-- Vendas importadas da Shopee / Mercado Livre (pedido do comprador na loja do
-- cliente). Entram sozinhas; o cliente só confere, anexa a etiqueta (no ML vem
-- pronta) e o comprovante do Pix, e o pedido ao fornecedor sai pré-preenchido.
-- Base também do relatório de lucro. Só o servidor grava; o cliente lê as suas.
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('shopee', 'mercado-livre')),
  external_order_id TEXT NOT NULL,
  external_item_id TEXT NOT NULL,
  shipment_id TEXT,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  sale_cents INTEGER NOT NULL,
  cost_cents INTEGER,
  buyer_name TEXT,
  channel_status TEXT,
  ordered_at TIMESTAMPTZ NOT NULL,
  fulfillment_request_id UUID REFERENCES public.fulfillment_requests(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (marketplace, external_order_id, external_item_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_user ON public.marketplace_orders(user_id, ordered_at DESC);
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_orders_select_own ON public.marketplace_orders;
CREATE POLICY marketplace_orders_select_own ON public.marketplace_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
