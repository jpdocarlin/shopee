-- Corte de acesso de quem para de pagar (plano mensal), reembolso e chargeback.
--
-- access_blocked_at: a partir de quando a conta fica sem acesso ao app.
--   NULL            -> acesso liberado
--   data no futuro  -> liberado até lá (ex.: cancelou a assinatura, mas o mês
--                      já pago vai até nextChargeAt)
--   data no passado -> bloqueado
-- access_block_reason: motivo mostrado na tela de acesso suspenso
--   ('subscription_canceled', 'subscription_expired', 'refunded', 'chargeback').
--
-- Quem escreve é só o webhook da Applyfy (service role). A conta não apaga
-- mais no reembolso: bloqueia e mantém pedidos/histórico.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_block_reason TEXT;

-- profiles_update_own deixa o usuário dar UPDATE na própria linha — sem isso,
-- ele mesmo conseguiria se desbloquear pelo navegador. O trigger ignora
-- qualquer mudança nessas duas colunas vinda de um usuário logado
-- (role "authenticated"); service role e SQL Editor passam normalmente.
CREATE OR REPLACE FUNCTION public.protect_profile_access_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.access_blocked_at := OLD.access_blocked_at;
      NEW.access_block_reason := OLD.access_block_reason;
    ELSE
      NEW.access_blocked_at := NULL;
      NEW.access_block_reason := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_profiles_protect_access
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_columns();
