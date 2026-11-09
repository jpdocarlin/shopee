-- Banco interno de categorias por produto do catálogo (09/11/2026).
-- Uma linha por produto + marketplace. Só o servidor (service role) lê e
-- grava: RLS ligado e nenhuma policy.
-- Já aplicada em produção em 09/11/2026.
create table if not exists public.product_categories (
  product_id text not null,
  marketplace text not null check (marketplace in ('shopee', 'mercado-livre')),
  category_id text not null,
  category_path text,
  product_name text,
  status text not null default 'auto' check (status in ('verified', 'auto')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, marketplace)
);
alter table public.product_categories enable row level security;
