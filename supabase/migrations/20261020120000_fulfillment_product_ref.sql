-- Pedido guarda QUAL produto do catálogo foi vendido (mesmo id/nome/foto de
-- capa do Criar Anúncio) — antes era só um texto livre e o dono não conseguia
-- saber qual produto separar.
ALTER TABLE public.fulfillment_requests
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_image_url TEXT;
