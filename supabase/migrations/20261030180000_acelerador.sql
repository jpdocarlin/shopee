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

-- Turmas do Acelerador: cada 5 alunos = 1 grupo de WhatsApp.
CREATE TABLE IF NOT EXISTS public.acelerador_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL UNIQUE,
  whatsapp_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.acelerador_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.acelerador_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE,
  group_id UUID NOT NULL REFERENCES public.acelerador_groups(id),
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  link_sent_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded'))
);
CREATE INDEX IF NOT EXISTS idx_acelerador_members_group ON public.acelerador_members(group_id);
ALTER TABLE public.acelerador_members ENABLE ROW LEVEL SECURITY;
