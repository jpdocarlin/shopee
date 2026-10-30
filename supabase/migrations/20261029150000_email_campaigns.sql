-- Envio de e-mail em massa pros usuários (ex.: convite da comunidade).
-- Campanha começa DESLIGADA: com active=false o cron só manda pro e-mail de
-- teste. Quando o Jp aprovar, liga active=true e o cron manda em lotes diários.
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  daily_limit INTEGER NOT NULL DEFAULT 100,
  test_to TEXT,
  test_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_campaign_sends (
  campaign_id TEXT NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);
ALTER TABLE public.email_campaign_sends ENABLE ROW LEVEL SECURITY;

-- Quem clicou em "Sair da lista" não recebe mais e-mail de divulgação
-- (os do sistema — reembolso etc. — continuam).
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.email_campaigns (id, active, daily_limit)
VALUES ('comunidade-telegram', false, 100)
ON CONFLICT (id) DO NOTHING;
