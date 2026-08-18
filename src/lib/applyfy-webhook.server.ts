import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

// Senha fixa de primeiro acesso: "senha do 1 até o 8" — combinado com o Jp.
// A pessoa troca depois em Configurações → Alterar senha, se quiser.
const DEFAULT_PASSWORD = "12345678";

// Preço R$249 = Vitalício, R$149 = Mensal. A Applyfy não expõe o nome da
// oferta no payload do webhook (só id/externalId do produto), então o plano
// é decidido pelo valor da transação. R$200 fica bem no meio dos dois preços.
const VITALICIO_THRESHOLD_REAIS = 200;

let _admin: ReturnType<typeof createClient<Database>> | undefined;

function getAdminClient() {
  if (_admin) return _admin;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var — necessário para o webhook da Applyfy criar/apagar usuários.",
    );
  }

  _admin = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

export type ApplyfyPayload = {
  event?: string;
  token?: string;
  client?: { email?: string | null } | null;
  transaction?: {
    originalAmount?: number | null;
    commissionAmount?: number | null;
    status?: string | null;
  } | null;
};

// Compara o token que veio DENTRO do corpo do JSON (não é header) contra o
// token de validação gerado pela Applyfy ao criar o webhook.
export function verifyApplyfyToken(payload: ApplyfyPayload): boolean {
  const expected = process.env.APPLYFY_WEBHOOK_TOKEN;
  if (!expected) {
    throw new Error("Missing APPLYFY_WEBHOOK_TOKEN env var.");
  }
  return payload.token === expected;
}

function detectPlan(payload: ApplyfyPayload): "mensal" | "vitalicio" {
  const raw = payload.transaction?.originalAmount ?? payload.transaction?.commissionAmount ?? 0;
  // A Applyfy pode mandar o valor em centavos ou em reais dependendo do
  // campo/integração; se vier "grande demais" pra ser reais, assume centavos.
  const amountInReais = raw > 1000 ? raw / 100 : raw;
  return amountInReais >= VITALICIO_THRESHOLD_REAIS ? "vitalicio" : "mensal";
}

// Não existe "get user by email" no admin API do Supabase — precisa listar
// (paginado) e filtrar. 200/página cobre a base atual com folga.
async function findUserByEmail(email: string) {
  const admin = getAdminClient();
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) break; // última página
  }
  return null;
}

export type WebhookResult =
  | { ok: true; userId: string; plan?: "mensal" | "vitalicio" }
  | { ok: false; reason: string; error?: string };

// Evento "Transação paga": cria o login da Shoppfy com o email do pagamento
// e senha fixa, já confirmado (sem etapa de confirmação por email), e marca
// o plano de acordo com o valor pago.
export async function handleTransactionPaid(payload: ApplyfyPayload): Promise<WebhookResult> {
  const email = payload.client?.email?.trim().toLowerCase();
  if (!email) return { ok: false, reason: "missing_email" };

  const plan = detectPlan(payload);
  const admin = getAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });

  let userId: string;
  if (error || !data.user) {
    // A Applyfy pode reenviar o mesmo evento (retry de webhook é comum em
    // gateways de pagamento) — se o login já existe pra esse email, não é
    // falha de verdade: só acha o usuário já criado e segue pra atualizar o
    // plano, em vez de devolver erro e deixar a pessoa sem plano marcado.
    const existing = await findUserByEmail(email);
    if (!existing) {
      return { ok: false, reason: "create_user_failed", error: error?.message };
    }
    userId = existing.id;
  } else {
    userId = data.user.id;
  }

  const { error: profileError } = await admin.from("profiles").update({ plan }).eq("id", userId);
  if (profileError) {
    // Usuário já foi criado (login funciona); só o plano não foi salvo.
    return { ok: false, reason: "plan_update_failed", error: profileError.message };
  }

  return { ok: true, userId, plan };
}

// Evento "Transação estornada": apaga a conta que tinha sido criada para
// esse email — não existe fluxo de "reembolso parcial", é tudo ou nada.
export async function handleTransactionRefunded(payload: ApplyfyPayload): Promise<WebhookResult> {
  const email = payload.client?.email?.trim().toLowerCase();
  if (!email) return { ok: false, reason: "missing_email" };

  const admin = getAdminClient();
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "user_not_found" };

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, reason: "delete_user_failed", error: error.message };

  return { ok: true, userId: user.id };
}
