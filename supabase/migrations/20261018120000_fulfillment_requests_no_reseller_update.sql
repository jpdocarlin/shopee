-- Revendedor não altera mais pedidos já enviados.
--
-- A policy "fulfillment_requests_update_own" deixava o revendedor dar UPDATE
-- em QUALQUER coluna dos próprios pedidos (status, cost_cents, tracking_code)
-- chamando o Supabase direto do navegador, sem passar pela tela. Nenhuma tela
-- do revendedor usa UPDATE (os botões de status em pedidos-list.tsx só
-- aparecem pro dono), então só o admin continua podendo alterar pedidos —
-- pelas policies de admin, que não mudam aqui.
--
-- Reverter (se precisar):
--   CREATE POLICY "fulfillment_requests_update_own" ON public.fulfillment_requests
--     FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fulfillment_requests_update_own" ON public.fulfillment_requests;
