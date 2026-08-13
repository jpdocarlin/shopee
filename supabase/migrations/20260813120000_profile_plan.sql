-- Plano de assinatura declarado pelo próprio usuário em Configurações.
-- Não temos integração com gateway de pagamento pra saber automaticamente
-- em qual plano a pessoa está, então ela escolhe manualmente entre os dois
-- planos vigentes (Mensal R$149 / Vitalício R$249). RLS de profiles já
-- cobre esta coluna nova (profiles_select_own / profiles_update_own).

create type public.billing_plan as enum ('mensal', 'vitalicio');

alter table public.profiles
  add column plan public.billing_plan;
