-- Atendimento v2: bot resolve sozinho; compras guardadas pra achar o código;
-- reembolso de verdade (antes o formulário não salvava nada).

-- Compras confirmadas na Applyfy (preenchido pelo webhook TRANSACTION_PAID).
-- "Código da compra" = id da transação na Applyfy. Só o servidor lê.
CREATE TABLE IF NOT EXISTS public.purchases (
  transaction_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  client_name TEXT,
  plan TEXT,
  amount NUMERIC,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON public.purchases(lower(email));
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Pedidos de reembolso feitos em Configurações → Reembolso.
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  purchase_code TEXT NOT NULL,
  plan TEXT NOT NULL,
  days_since_payment INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refund_requests_select_own" ON public.refund_requests;
CREATE POLICY "refund_requests_select_own" ON public.refund_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "refund_requests_admin_all" ON public.refund_requests;
CREATE POLICY "refund_requests_admin_all" ON public.refund_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
