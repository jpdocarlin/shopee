-- Order bump "Lista dos Produtos Campeões" (R$ 27) e upsell "Call de
-- implementação" (R$ 127), vendidos na Applyfy.

-- Toda chamada do webhook da Applyfy fica guardada (sem o token) — serve pra
-- ver o formato real do payload e investigar qualquer compra.
CREATE TABLE IF NOT EXISTS public.applyfy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT,
  email TEXT,
  transaction_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applyfy_events ENABLE ROW LEVEL SECURITY;

-- Como reconhecer cada produto no payload da Applyfy: id, externalId ou parte
-- do nome do produto/oferta (preenchido depois de criar os produtos lá).
CREATE TABLE IF NOT EXISTS public.applyfy_product_map (
  match TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('campeoes', 'call')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applyfy_product_map ENABLE ROW LEVEL SECURITY;

-- O que cada pessoa comprou além do plano.
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('campeoes', 'call')),
  transaction_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_entitlements_select_own ON public.user_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Calls de implementação: sala na próxima hora cheia (9h–21h de Brasília).
CREATE TABLE IF NOT EXISTS public.call_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  paid_at TIMESTAMPTZ NOT NULL,
  slot_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'done', 'no_show', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_bookings_slot ON public.call_bookings(slot_at);
ALTER TABLE public.call_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_bookings_select_own ON public.call_bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Configurações simples (ex.: link fixo da sala da call).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
