-- =========================================================
-- FULFILLMENT TRACKING · código de rastreio + notificação em tempo real
-- =========================================================
-- O dono do Shoppfy confirma o pedido no fornecedor e manda o código de
-- rastreio de volta pro revendedor. Isso precisa chegar em tempo real na
-- ferramenta (sem o revendedor precisar ficar atualizando a página).

ALTER TABLE public.fulfillment_requests
  ADD COLUMN tracking_code TEXT,
  ADD COLUMN tracking_sent_at TIMESTAMPTZ;

-- REPLICA IDENTITY FULL: sem isso, o payload de UPDATE do Realtime só traz a
-- chave primária no registro "old" — não dá pra comparar se o tracking_code
-- acabou de ser preenchido (transição de NULL pra um valor) ou já estava
-- setado antes. Com FULL, o "old" vem completo e dá pra fazer esse diff.
ALTER TABLE public.fulfillment_requests REPLICA IDENTITY FULL;

-- Liga a tabela no Realtime (Postgres Changes). O Supabase Realtime respeita
-- a RLS já existente na tabela, então cada revendedor só recebe eventos dos
-- próprios pedidos (e o dono, de todos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fulfillment_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fulfillment_requests;
  END IF;
END $$;
