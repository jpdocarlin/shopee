-- Contador compartilhado entre o Shoppfy e o painel-shopee (dashboard público
-- separado, hospedado em outro projeto). Toda vez que uma venda é simulada
-- pela bolinha do header (useDemoBoostStore), a gente soma o valor aqui, e o
-- painel-shopee lê esse valor por polling pra aumentar a comissão exibida.
--
-- Não guarda nada sensível — é só um contador em centavos, com uma única
-- linha fixa. RLS restringe pra: qualquer um pode ler (o painel é público,
-- sem login), e a única forma de escrever é via a função
-- increment_panel_commission, que só soma (nunca zera nem lê outras linhas).

create table public.panel_sync (
  id text primary key,
  extra_commission_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.panel_sync (id, extra_commission_cents)
values ('shoppfy-painel', 0);

alter table public.panel_sync enable row level security;

create policy "panel_sync_select_all"
  on public.panel_sync
  for select
  using (true);

create or replace function public.increment_panel_commission(amount_cents bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.panel_sync
  set extra_commission_cents = extra_commission_cents + amount_cents,
      updated_at = now()
  where id = 'shoppfy-painel';
$$;

grant execute on function public.increment_panel_commission(bigint) to anon, authenticated;
