-- =========================================================
-- ADMIN ROLE · troca o "e-mail fixo no código" por role no banco
-- =========================================================
-- Contexto: useIsOwner() no frontend comparava um e-mail escrito direto no
-- arquivo src/lib/owner.ts. Como esse arquivo roda no cliente, o e-mail do
-- dono ia junto no JavaScript público do site — qualquer visitante conseguia
-- achar abrindo o DevTools (achado reportado externamente em 17/08/2026).
--
-- Esta migration: (1) marca a conta do dono com role 'admin' na tabela
-- user_roles que já existia (só não estava sendo usada pra isso), e (2) troca
-- as políticas de RLS que comparavam e-mail fixo no JWT por checagem de role
-- via has_role() — mais consistente, e não precisa saber o e-mail do dono
-- pra decidir quem é admin.

-- ---------- 1. concede a role admin pra conta do dono ----------
-- Busca pelo e-mail só aqui, num script que roda direto no Postgres (nunca
-- chega no navegador) — diferente do e-mail fixo que existia no bundle do
-- cliente, isto aqui não vaza pra lugar nenhum.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'jpnogueiraz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------- 2. RLS de fulfillment_requests: e-mail fixo -> has_role() ----------
DROP POLICY IF EXISTS "fulfillment_requests_owner_select_all" ON public.fulfillment_requests;
DROP POLICY IF EXISTS "fulfillment_requests_owner_update_all" ON public.fulfillment_requests;

CREATE POLICY "fulfillment_requests_owner_select_all" ON public.fulfillment_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fulfillment_requests_owner_update_all" ON public.fulfillment_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- 3. RLS de storage (etiqueta + comprovante PIX): idem ----------
DROP POLICY IF EXISTS "fulfillment_attachments_owner_select_all" ON storage.objects;

CREATE POLICY "fulfillment_attachments_owner_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fulfillment-attachments'
    AND public.has_role(auth.uid(), 'admin')
  );
