-- =========================================================
-- FULFILLMENT REQUESTS · pedidos de fornecedor (C7 Drop e afins)
-- =========================================================
-- Quando um revendedor do Shoppfy vende um produto, ele registra o pedido
-- aqui: produto, custo (sem a margem dele), etiqueta de envio e comprovante
-- do PIX. O dono do Shoppfy (jpnogueiraz@gmail.com) enxerga todos os
-- pedidos de todos os revendedores; cada revendedor só enxerga os seus.

CREATE TYPE public.fulfillment_status AS ENUM ('pending', 'confirmed', 'shipped', 'canceled');
CREATE TYPE public.person_type AS ENUM ('fisica', 'juridica');

CREATE TABLE public.fulfillment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Snapshot dos dados de quem enviou o pedido (não depende de RLS de
  -- `profiles` pra o dono ver "quem fez o pedido" — fica tudo autocontido
  -- nesta tabela). São os dados do REVENDEDOR (pra faturamento no
  -- fornecedor), não da pessoa que comprou o produto dele.
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_phone TEXT NOT NULL,
  submitter_person_type public.person_type NOT NULL DEFAULT 'fisica',
  submitter_document TEXT NOT NULL,
  product_name TEXT NOT NULL,
  cost_cents INTEGER NOT NULL,
  status public.fulfillment_status NOT NULL DEFAULT 'pending',
  label_path TEXT,
  proof_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fulfillment_requests_user ON public.fulfillment_requests(user_id, created_at DESC);
CREATE INDEX idx_fulfillment_requests_status ON public.fulfillment_requests(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.fulfillment_requests TO authenticated;
GRANT ALL ON public.fulfillment_requests TO service_role;
ALTER TABLE public.fulfillment_requests ENABLE ROW LEVEL SECURITY;

-- Cada revendedor só vê e mexe nos próprios pedidos.
CREATE POLICY "fulfillment_requests_select_own" ON public.fulfillment_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fulfillment_requests_insert_own" ON public.fulfillment_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fulfillment_requests_update_own" ON public.fulfillment_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Dono do Shoppfy enxerga e atualiza (ex: status) os pedidos de todo mundo.
CREATE POLICY "fulfillment_requests_owner_select_all" ON public.fulfillment_requests
  FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = 'jpnogueiraz@gmail.com');
CREATE POLICY "fulfillment_requests_owner_update_all" ON public.fulfillment_requests
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jpnogueiraz@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jpnogueiraz@gmail.com');

CREATE TRIGGER trg_fulfillment_requests_updated
  BEFORE UPDATE ON public.fulfillment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- storage: etiqueta + comprovante PIX ----------
-- Bucket privado. Caminho de cada arquivo: {user_id}/{request_id}/{label|proof}-nome-original
INSERT INTO storage.buckets (id, name, public)
VALUES ('fulfillment-attachments', 'fulfillment-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fulfillment_attachments_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fulfillment-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "fulfillment_attachments_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fulfillment-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "fulfillment_attachments_owner_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fulfillment-attachments'
    AND (auth.jwt() ->> 'email') = 'jpnogueiraz@gmail.com'
  );
