-- =========================================================
-- FORNECEFY · CORE SCHEMA
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- enums ----------
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'affiliate');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','incomplete');
CREATE TYPE public.order_status AS ENUM ('pending','approved','shipped','delivered','canceled','refunded');
CREATE TYPE public.commission_status AS ENUM ('pending','approved','paid','canceled');
CREATE TYPE public.withdraw_status AS ENUM ('requested','processing','paid','rejected');
CREATE TYPE public.pix_key_type AS ENUM ('cpf','cnpj','email','phone','random');

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  company_name TEXT,
  phone TEXT,
  document TEXT,
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- user_roles ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'affiliate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ---------- plans ----------
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month',
  search_limit INTEGER NOT NULL DEFAULT 100,
  ai_limit INTEGER NOT NULL DEFAULT 50,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT TO anon, authenticated USING (is_active);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- subscriptions ----------
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_own" ON public.subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- marketplaces ----------
CREATE TABLE public.marketplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  base_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplaces TO anon, authenticated;
GRANT ALL ON public.marketplaces TO service_role;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplaces_public_read" ON public.marketplaces FOR SELECT TO anon, authenticated USING (is_active);

-- ---------- marketplace_accounts ----------
CREATE TABLE public.marketplace_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  affiliate_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_accounts_user ON public.marketplace_accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_accounts TO authenticated;
GRANT ALL ON public.marketplace_accounts TO service_role;
ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_accounts_own" ON public.marketplace_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_mkt_accounts_updated BEFORE UPDATE ON public.marketplace_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- products ----------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  product_url TEXT,
  affiliate_url TEXT,
  category TEXT,
  seller_name TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  original_price_cents INTEGER,
  commission_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  reviews_count INTEGER NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  stock INTEGER,
  opportunity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace_id, external_id)
);
CREATE INDEX idx_products_user_created ON public.products(user_id, created_at DESC);
CREATE INDEX idx_products_category ON public.products(user_id, category);
CREATE INDEX idx_products_score ON public.products(user_id, opportunity_score DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_own" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- product_prices ----------
CREATE TABLE public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  commission_rate NUMERIC(6,3),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_prices_product ON public.product_prices(product_id, captured_at DESC);
GRANT SELECT, INSERT, DELETE ON public.product_prices TO authenticated;
GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_prices_own" ON public.product_prices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- product_history ----------
CREATE TABLE public.product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_history_product ON public.product_history(product_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.product_history TO authenticated;
GRANT ALL ON public.product_history TO service_role;
ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_history_own" ON public.product_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- favorites ----------
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  target_price_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_favorites_user ON public.favorites(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- collections (catálogo) ----------
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collections_user ON public.collections(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT ON public.collections TO anon;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "collections_owner_read" ON public.collections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "collections_owner_write" ON public.collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_owner_update" ON public.collections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_owner_delete" ON public.collections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_collections_updated BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_id)
);
CREATE INDEX idx_collection_items_collection ON public.collection_items(collection_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT ALL ON public.collection_items TO service_role;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_items_own" ON public.collection_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- commissions ----------
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
  category TEXT,
  rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  min_value_cents INTEGER,
  max_value_cents INTEGER,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_user ON public.commissions(user_id, marketplace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_own" ON public.commissions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- clicks ----------
CREATE TABLE public.clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
  source TEXT,
  campaign TEXT,
  country TEXT,
  device TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clicks_user_created ON public.clicks(user_id, created_at DESC);
CREATE INDEX idx_clicks_product ON public.clicks(product_id);
GRANT SELECT, INSERT, DELETE ON public.clicks TO authenticated;
GRANT ALL ON public.clicks TO service_role;
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clicks_own" ON public.clicks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- orders ----------
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  commission_status public.commission_status NOT NULL DEFAULT 'pending',
  total_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  buyer_state TEXT,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace_id, external_id)
);
CREATE INDEX idx_orders_user_date ON public.orders(user_id, ordered_at DESC);
CREATE INDEX idx_orders_status ON public.orders(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_own" ON public.orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- sales (itens do pedido) ----------
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  click_id UUID REFERENCES public.clicks(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_user ON public.sales(user_id, created_at DESC);
CREATE INDEX idx_sales_order ON public.sales(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_own" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- analytics_daily ----------
CREATE TABLE public.analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace_id, day)
);
CREATE INDEX idx_analytics_user_day ON public.analytics_daily(user_id, day DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_daily TO authenticated;
GRANT ALL ON public.analytics_daily TO service_role;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_own" ON public.analytics_daily FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_analytics_updated BEFORE UPDATE ON public.analytics_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- notifications ----------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- settings ----------
CREATE TABLE public.settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  price_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT true,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_own" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- pix_keys ----------
CREATE TABLE public.pix_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_type public.pix_key_type NOT NULL,
  key_value TEXT NOT NULL,
  holder_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key_value)
);
CREATE INDEX idx_pix_keys_user ON public.pix_keys(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_keys TO authenticated;
GRANT ALL ON public.pix_keys TO service_role;
ALTER TABLE public.pix_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pix_keys_own" ON public.pix_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- withdraws ----------
CREATE TABLE public.withdraws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pix_key_id UUID REFERENCES public.pix_keys(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  status public.withdraw_status NOT NULL DEFAULT 'requested',
  receipt_url TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdraws_user ON public.withdraws(user_id, requested_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdraws TO authenticated;
GRANT ALL ON public.withdraws TO service_role;
ALTER TABLE public.withdraws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdraws_own" ON public.withdraws FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_withdraws_updated BEFORE UPDATE ON public.withdraws FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- ai_generations ----------
CREATE TABLE public.ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'copy',
  model TEXT,
  prompt TEXT NOT NULL,
  output TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_generations_user ON public.ai_generations(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_generations_own" ON public.ai_generations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- signup bootstrap ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'affiliate') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- reference data ----------
INSERT INTO public.marketplaces (slug, name, brand_color, currency, base_url) VALUES
  ('shopee', 'Shopee', '#EE4D2D', 'BRL', 'https://shopee.com.br'),
  ('mercado-livre', 'Mercado Livre', '#FFE600', 'BRL', 'https://mercadolivre.com.br');

INSERT INTO public.plans (slug, name, description, price_cents, search_limit, ai_limit, sort_order, features) VALUES
  ('free', 'Free', 'Para começar a validar produtos', 0, 50, 10, 1, '["50 buscas/mês","Favoritos ilimitados"]'::jsonb),
  ('pro', 'Pro', 'Para afiliados em escala', 9700, 5000, 500, 2, '["5.000 buscas/mês","IA avançada","Alertas de preço"]'::jsonb),
  ('scale', 'Scale', 'Para operações e equipes', 24700, 50000, 5000, 3, '["Buscas ilimitadas","Equipe","API e webhooks"]'::jsonb);