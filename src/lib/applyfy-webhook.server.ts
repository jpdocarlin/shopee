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
  client?: { email?: string | null; name?: string | null } | null;
  transaction?: {
    id?: string | null;
    payedAt?: string | null;
    originalAmount?: number | null;
    commissionAmount?: number | null;
    status?: string | null;
  } | null;
  // Itens do pedido: cada produto com o preço SEM juros do parcelamento
  // (o `originalAmount` da transação vem com os juros embutidos).
  orderItems?: Array<{
    price?: number | null;
    product?: { id?: string | null; name?: string | null } | null;
  }> | null;
  // Só vem nos eventos SUBSCRIPTION_* (docs Applyfy: Webhooks → Assinaturas).
  subscription?: {
    status?: string | null;
    nextChargeAt?: string | null;
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

type Plan = "mensal" | "vitalicio";

// Ofertas do plano: Vitalício R$249 / R$147 · Mensal R$149 / R$97.
// `extrasReais` = valor dos extras que vieram juntos (ex.: order bump R$27),
// descontado antes de decidir o plano.
function planFromPrice(reais: number): Plan {
  if (Math.abs(reais - 147) < 1) return "vitalicio";
  return reais >= VITALICIO_THRESHOLD_REAIS ? "vitalicio" : "mensal";
}

function detectPlan(payload: ApplyfyPayload, extrasReais = 0): Plan {
  const raw = payload.transaction?.originalAmount ?? payload.transaction?.commissionAmount ?? 0;
  // A Applyfy pode mandar o valor em centavos ou em reais dependendo do
  // campo/integração; se vier "grande demais" pra ser reais, assume centavos.
  const amountInReais = (raw > 1000 ? raw / 100 : raw) - extrasReais;
  if (Math.abs(amountInReais - 147) < 1) return "vitalicio";
  return amountInReais >= VITALICIO_THRESHOLD_REAIS ? "vitalicio" : "mensal";
}

function payloadEmail(payload: ApplyfyPayload): string | null {
  return payload.client?.email?.trim().toLowerCase() || null;
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

async function getProfilePlan(userId: string): Promise<Plan | null> {
  const { data } = await getAdminClient()
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  return (data?.plan as Plan | null) ?? null;
}

export type WebhookResult =
  | { ok: true; userId?: string; plan?: Plan; ignored?: string; blockedAt?: string | null }
  | { ok: false; reason: string; error?: string };

// Evento "Transação paga" (compra nova OU renovação do mensal): cria o login
// da Shoppfy se ainda não existir, marca o plano e LIBERA o acesso — é isso
// que reativa quem estava bloqueado e voltou a pagar.
export async function handleTransactionPaid(payload: ApplyfyPayload): Promise<WebhookResult> {
  const email = payloadEmail(payload);
  if (!email) return { ok: false, reason: "missing_email" };

  const admin = getAdminClient();

  // Extras (order bump / upsell) que vieram nessa transação.
  const { detectAddons, grantAddons, payloadHasMainProduct, ADDON_PRICE, MAIN_PRODUCT_ID } =
    await import("@/lib/addons.server");
  const addons = await detectAddons(payload as Record<string, unknown>);
  const items = Array.isArray(payload.orderItems) ? payload.orderItems : [];
  const mainItem = items.find((i) => i?.product?.id === MAIN_PRODUCT_ID);
  let addonOnly: boolean;
  let detected: Plan;
  if (items.length) {
    // Formato atual da Applyfy: decide pelos produtos do pedido. Pedido sem o
    // produto Shoppfy = compra só do extra (ex.: Acelerador pelo checkout
    // dele, à vista ou parcelado) — nunca mexe no plano.
    addonOnly = addons.length > 0 && !mainItem;
    detected = mainItem?.price ? planFromPrice(Number(mainItem.price)) : detectPlan(payload);
  } else {
    // Fallback (payload sem itens): decide pelo valor total.
    const rawAmount =
      payload.transaction?.originalAmount ?? payload.transaction?.commissionAmount ?? 0;
    const amountReais = rawAmount > 1000 ? rawAmount / 100 : rawAmount;
    const addonsTotal = addons.reduce((sum, k) => sum + ADDON_PRICE[k], 0);
    addonOnly =
      addons.length > 0 &&
      !payloadHasMainProduct(payload as Record<string, unknown>) &&
      Math.abs(amountReais - addonsTotal) < 0.5;
    detected = detectPlan(payload, addonOnly ? 0 : addonsTotal);
  }
  const grant = (userId: string) =>
    addons.length
      ? grantAddons({
          userId,
          kinds: addons,
          transactionId: payload.transaction?.id?.trim() || null,
          email,
          name: payload.client?.name?.trim() || null,
          paidAt: payload.transaction?.payedAt ? new Date(payload.transaction.payedAt) : new Date(),
        }).catch((err) => console.error("[applyfy-webhook] falha ao liberar extra:", err))
      : Promise.resolve();
  if (addonOnly) {
    const existing = await findUserByEmail(email);
    if (existing) {
      await grant(existing.id);
      return { ok: true, userId: existing.id, ignored: `addon_only:${addons.join(",")}` };
    }
    // Comprou só o extra com um e-mail que não tem conta (ex.: digitou outro
    // e-mail no checkout do Acelerador). Nunca cria login nem plano a partir
    // de um extra — avisa a conta de pedidos pra resolver na mão. O evento
    // fica salvo em applyfy_events.
    const { sendToPedidosAdmins } = await import("@/lib/push.server");
    await sendToPedidosAdmins({
      title: "Extra comprado sem conta na Shoppfy",
      body: `${email} comprou ${addons.join(", ")} — e-mail sem conta. Confira e libere manualmente.`,
      url: "/calls-admin",
      tag: `addon-sem-conta-${payload.transaction?.id ?? email}`,
    }).catch(() => undefined);
    return { ok: true, ignored: `addon_without_account:${addons.join(",")}` };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });

  let userId: string;
  if (error || !data.user) {
    // A Applyfy reenvia eventos e manda TRANSACTION_PAID em toda renovação do
    // mensal — se o login já existe, só acha o usuário e segue.
    const existing = await findUserByEmail(email);
    if (!existing) {
      return { ok: false, reason: "create_user_failed", error: error?.message };
    }
    userId = existing.id;
  } else {
    userId = data.user.id;
  }

  // Nunca rebaixa: quem já é vitalício e paga uma mensalidade continua vitalício.
  const current = await getProfilePlan(userId);
  const plan: Plan = current === "vitalicio" ? "vitalicio" : detected;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ plan, access_blocked_at: null, access_block_reason: null })
    .eq("id", userId);
  if (profileError) {
    // Usuário já foi criado (login funciona); só o plano/liberação não foi salvo.
    return { ok: false, reason: "plan_update_failed", error: profileError.message };
  }

  // Guarda a compra (o "código da compra" que o cliente precisa no
  // formulário de reembolso é o id da transação). Falha aqui não derruba o
  // webhook — o login e o plano já foram liberados acima.
  const transactionId = payload.transaction?.id?.trim();
  if (transactionId) {
    const raw =
      payload.transaction?.originalAmount ?? payload.transaction?.commissionAmount ?? null;
    const { error: purchaseError } = await admin.from("purchases").upsert(
      {
        transaction_id: transactionId,
        user_id: userId,
        email,
        client_name: payload.client?.name?.trim() || null,
        plan: detected,
        amount: raw === null ? null : raw > 1000 ? raw / 100 : raw,
        paid_at: payload.transaction?.payedAt ?? new Date().toISOString(),
      },
      { onConflict: "transaction_id" },
    );
    if (purchaseError)
      console.error("[applyfy-webhook] falha ao salvar compra:", purchaseError.message);
  }

  await grant(userId);
  return { ok: true, userId, plan };
}

// SUBSCRIPTION_STARTED / SUBSCRIPTION_RENEWED: só garante que o acesso está
// liberado. Quem cria o login é o TRANSACTION_PAID (chega junto).
export async function handleSubscriptionActive(payload: ApplyfyPayload): Promise<WebhookResult> {
  const email = payloadEmail(payload);
  if (!email) return { ok: false, reason: "missing_email" };

  const user = await findUserByEmail(email);
  if (!user) return { ok: true, ignored: "user_not_found" };

  const { error } = await getAdminClient()
    .from("profiles")
    .update({ access_blocked_at: null, access_block_reason: null })
    .eq("id", user.id);
  if (error) return { ok: false, reason: "unblock_failed", error: error.message };
  return { ok: true, userId: user.id, blockedAt: null };
}

export type BlockReason =
  "subscription_canceled" | "subscription_expired" | "refunded" | "chargeback";

// Bloqueia o acesso (sem apagar a conta — pedidos e histórico continuam lá).
// `at` no futuro = continua liberado até essa data (ex.: cancelou o mensal,
// mas o mês já pago vai até a próxima cobrança).
export async function handleAccessBlock(
  payload: ApplyfyPayload,
  reason: BlockReason,
): Promise<WebhookResult> {
  const email = payloadEmail(payload);
  if (!email) return { ok: false, reason: "missing_email" };

  const user = await findUserByEmail(email);
  // 200 em vez de erro: sem conta não há o que bloquear, e um 4xx faria a
  // Applyfy reenviar o mesmo evento várias vezes à toa.
  if (!user) return { ok: true, ignored: "user_not_found" };

  const isSubscriptionEvent =
    reason === "subscription_canceled" || reason === "subscription_expired";
  if (isSubscriptionEvent && (await getProfilePlan(user.id)) === "vitalicio") {
    // Fim de uma assinatura mensal antiga não tira o acesso de quem já é vitalício.
    return { ok: true, userId: user.id, ignored: "lifetime_plan" };
  }

  const now = new Date();
  let blockAt = now;
  if (reason === "subscription_canceled") {
    const nextCharge = payload.subscription?.nextChargeAt
      ? new Date(payload.subscription.nextChargeAt)
      : null;
    if (nextCharge && !Number.isNaN(nextCharge.getTime()) && nextCharge > now) {
      blockAt = nextCharge;
    }
  }

  const { error } = await getAdminClient()
    .from("profiles")
    .update({ access_blocked_at: blockAt.toISOString(), access_block_reason: reason })
    .eq("id", user.id);
  if (error) return { ok: false, reason: "block_failed", error: error.message };

  return { ok: true, userId: user.id, blockedAt: blockAt.toISOString() };
}
