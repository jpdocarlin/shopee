-- Upsell "Acelerador Shoppfy 30 Dias" (R$ 247) vendido na Applyfy.
ALTER TABLE public.applyfy_product_map DROP CONSTRAINT IF EXISTS applyfy_product_map_kind_check;
ALTER TABLE public.applyfy_product_map
  ADD CONSTRAINT applyfy_product_map_kind_check CHECK (kind IN ('campeoes', 'call', 'acelerador'));

ALTER TABLE public.user_entitlements DROP CONSTRAINT IF EXISTS user_entitlements_kind_check;
ALTER TABLE public.user_entitlements
  ADD CONSTRAINT user_entitlements_kind_check CHECK (kind IN ('campeoes', 'call', 'acelerador'));

INSERT INTO public.applyfy_product_map (match, kind) VALUES
  ('cmvuq3b4q0pwp01okxx88nh2t', 'acelerador'),
  ('Acelerador Shoppfy 30 Dias', 'acelerador')
ON CONFLICT (match) DO NOTHING;
