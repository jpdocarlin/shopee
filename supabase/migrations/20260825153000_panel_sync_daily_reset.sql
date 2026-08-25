-- O contador de comissão extra do painel-shopee (panel_sync) precisa voltar
-- pra zero automaticamente à meia-noite (horário de Brasília), sem depender
-- de nenhum cliente rodando um cron. A abordagem é "lazy reset": guardamos
-- em qual dia (America/Sao_Paulo) o contador foi atualizado pela última vez,
-- e tanto a leitura quanto a escrita comparam esse dia com o dia atual antes
-- de usar o valor guardado.

alter table public.panel_sync
  add column reset_day date not null default (now() at time zone 'America/Sao_Paulo')::date;

-- Leitura: se o contador é de um dia anterior, devolve 0 sem precisar
-- escrever nada — assim o painel já mostra zerado no primeiro load do dia
-- novo, mesmo que ainda não tenha rolado nenhuma venda hoje.
create or replace function public.get_panel_commission()
returns bigint
language sql
stable
set search_path = public
as $$
  select case
    when reset_day = (now() at time zone 'America/Sao_Paulo')::date
      then extra_commission_cents
    else 0
  end
  from public.panel_sync
  where id = 'shoppfy-painel';
$$;

grant execute on function public.get_panel_commission() to anon, authenticated;

-- Escrita: se o contador é de um dia anterior, zera antes de somar a venda
-- nova (em vez de somar em cima de um valor "velho" de ontem).
create or replace function public.increment_panel_commission(amount_cents bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.panel_sync
  set extra_commission_cents = case
        when reset_day = (now() at time zone 'America/Sao_Paulo')::date
          then extra_commission_cents + amount_cents
        else amount_cents
      end,
      reset_day = (now() at time zone 'America/Sao_Paulo')::date,
      updated_at = now()
  where id = 'shoppfy-painel';
$$;

grant execute on function public.increment_panel_commission(bigint) to anon, authenticated;
