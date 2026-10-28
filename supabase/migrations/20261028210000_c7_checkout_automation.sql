-- Compra na C7 automatizada (extensão do Chrome da conta de pedidos).
-- 1) O pedido passa a guardar a variação (cor) e a quantidade.
ALTER TABLE public.fulfillment_requests ADD COLUMN IF NOT EXISTS variation TEXT;
ALTER TABLE public.fulfillment_requests ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- 2) Passe de uso curto (30 min) que o botão "Comprar na C7" gera pra
-- extensão buscar os dados do pedido. Só o servidor (service role) lê/grava.
CREATE TABLE IF NOT EXISTS public.c7_handoffs (
  token TEXT PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.fulfillment_requests(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  first_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.c7_handoffs ENABLE ROW LEVEL SECURITY;
