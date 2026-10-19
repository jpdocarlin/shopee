-- Notificação push (Web Push / PWA) de pedido novo pra conta de pedidos.
--
-- push_subscriptions: cada aparelho que ativou as notificações (iPhone com o
--   app na tela inicial, navegador do PC...). Sem policies: só o servidor
--   (service role) lê e grava — o app salva/consulta via server function.
-- push_config: par de chaves VAPID gerado uma vez pelo próprio servidor (a
--   chave privada nunca sai do servidor). Também sem policies.
-- fulfillment_requests.admin_notified_at: garante uma notificação por pedido.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vapid_public_key TEXT NOT NULL,
  vapid_private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fulfillment_requests
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;
