-- Notificação de mudanças no catálogo (produto novo, preço subiu/baixou,
-- esgotou, voltou ao estoque) pra todos os clientes com push ativo.
-- catalog_snapshot = última versão do catálogo que já foi avisada.
-- catalog_notify_state = trava: só uma execução avisa cada versão nova.
-- Só o servidor (service role) lê/escreve: RLS ligado e sem policies.
CREATE TABLE IF NOT EXISTS public.catalog_snapshot (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  in_stock BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_snapshot ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.catalog_notify_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  catalog_version TEXT,
  last_run_at TIMESTAMPTZ,
  last_summary JSONB
);
ALTER TABLE public.catalog_notify_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.catalog_notify_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
