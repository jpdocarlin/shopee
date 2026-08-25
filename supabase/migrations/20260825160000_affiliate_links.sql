-- =========================================================
-- AFFILIATE LINKS · Meus Links persistido no banco (por usuário)
-- =========================================================
-- Antes disso, "Meus Links" vivia só no localStorage do navegador
-- (useAffiliateStore com zustand/persist). Dois problemas conhecidos:
--   1. Some sozinho às vezes: o app zera os stores locais sempre que detecta
--      "troca de usuário" (auth-provider.tsx), e isso também dispara se a
--      sessão expira e o Supabase não consegue renovar o token sozinho —
--      nesse caso o app trata como logout e limpa o localStorage.
--   2. Nunca sincroniza entre aparelhos: localStorage é por navegador, então
--      um link salvo no PC nunca aparece no celular.
-- Migrando pra uma tabela de verdade, com RLS por user_id, os links passam a
-- viver no banco (persistem pra sempre, independente de sessão/cache local)
-- e aparecem em qualquer aparelho que a pessoa logar.

CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  -- title/marketplace/image/productUrl/source do produto — usado quando o
  -- link não é de um produto do catálogo DEMO_PRODUCTS (ad-hoc, capturado
  -- pela extensão ou colado manualmente).
  meta JSONB,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_affiliate_links_user ON public.affiliate_links(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_links_select_own" ON public.affiliate_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "affiliate_links_insert_own" ON public.affiliate_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "affiliate_links_update_own" ON public.affiliate_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "affiliate_links_delete_own" ON public.affiliate_links
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_affiliate_links_updated
  BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
