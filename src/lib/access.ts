// Acesso ao app por pagamento (plano mensal, reembolso, chargeback).
//
// Quem escreve access_blocked_at / access_block_reason é só o webhook da
// Applyfy (service role) — ver supabase/migrations/20261018130000_profiles_access_control.sql.
// Aqui fica só a leitura: o app mostra a tela de acesso suspenso e o
// middleware das server functions recusa as chamadas.

// Colunas do perfil carregadas no cliente (auth-provider + saves em profile.ts).
export const PROFILE_COLUMNS =
  "id, email, full_name, onboarding_done, plan, access_blocked_at, access_block_reason";

export type AccessBlockReason =
  "subscription_canceled" | "subscription_expired" | "refunded" | "chargeback";

export function isAccessBlocked(
  profile: { access_blocked_at: string | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!profile?.access_blocked_at) return false;
  const at = new Date(profile.access_blocked_at).getTime();
  return !Number.isNaN(at) && at <= now;
}

export const ACCESS_BLOCK_MESSAGES: Record<AccessBlockReason, { title: string; body: string }> = {
  subscription_canceled: {
    title: "Sua assinatura foi cancelada",
    body: "O período que você já tinha pago terminou. Renove o plano pra voltar a usar o Shoppfy — seus anúncios, pedidos e histórico continuam guardados.",
  },
  subscription_expired: {
    title: "Sua mensalidade não foi paga",
    body: "Não recebemos o pagamento da renovação do seu plano. Assim que você pagar, o acesso volta na hora — seus anúncios, pedidos e histórico continuam guardados.",
  },
  refunded: {
    title: "Sua compra foi reembolsada",
    body: "Como o valor do seu plano foi devolvido, o acesso ao Shoppfy foi encerrado. Se quiser voltar, é só assinar de novo.",
  },
  chargeback: {
    title: "Seu pagamento foi contestado",
    body: "O banco do cartão contestou o pagamento do seu plano, então o acesso foi suspenso. Se foi um engano, fale com o suporte.",
  },
};

export const DEFAULT_ACCESS_BLOCK_MESSAGE = {
  title: "Seu acesso está suspenso",
  body: "Renove o seu plano pra voltar a usar o Shoppfy — seus dados continuam guardados.",
};

// Mesmo checkout da página de vendas (shoppfy.site), sem código de afiliado.
export const RENEW_CHECKOUT_URL =
  "https://checkout.applyfy.com.br/checkout/cmrujoz4g08o101oruu9qhwnu?offer=wrtzxwu";
