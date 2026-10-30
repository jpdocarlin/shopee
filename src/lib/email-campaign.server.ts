// Server-only: campanha de e-mail pra todos os usuários ATIVOS da Shoppfy
// (sem reembolso pedido, sem acesso bloqueado, que não saíram da lista).
// Manda em lotes diários pra caber no plano grátis do Resend (100/dia).
import { createHmac, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE = "https://www.shoppfy.online";

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET;
  if (!s) throw new Error("Sem segredo pra assinar o link de sair da lista.");
  return s;
}

// Link de "Sair da lista" assinado: só funciona pro próprio usuário.
export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}
export function verifyUnsubscribe(userId: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function unsubscribeUrl(userId: string): string {
  return `${SITE}/api/email/sair?u=${userId}&t=${unsubscribeToken(userId)}`;
}

type Campaign = {
  id: string;
  active: boolean;
  daily_limit: number;
  test_to: string | null;
  test_sent_at: string | null;
};

async function eligibleUsers(campaignId: string) {
  // Todos os usuários com e-mail confirmado (paginado).
  const users: Array<{ id: string; email: string }> = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && u.email_confirmed_at) users.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 1000) break;
  }
  const [
    { data: blocked },
    { data: refunds },
    { data: unsubs },
    { data: sent },
    { data: profiles },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id").not("access_blocked_at", "is", null),
    supabaseAdmin.from("refund_requests" as never).select("user_id"),
    supabaseAdmin.from("email_unsubscribes" as never).select("user_id"),
    supabaseAdmin
      .from("email_campaign_sends" as never)
      .select("user_id")
      .eq("campaign_id", campaignId),
    supabaseAdmin.from("profiles").select("id, full_name"),
  ]);
  const out = new Set<string>([
    ...(blocked ?? []).map((r) => r.id),
    ...((refunds ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ...((unsubs ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ...((sent ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));
  return users
    .filter((u) => !out.has(u.id))
    .map((u) => ({ ...u, firstName: names.get(u.id)?.trim().split(/\s+/)[0] || null }));
}

function prettyFirstName(n: string | null): string | null {
  if (!n) return null;
  return n.charAt(0).toLocaleUpperCase("pt-BR") + n.slice(1).toLocaleLowerCase("pt-BR");
}

export async function runCommunityCampaign(campaignId = "comunidade-telegram") {
  const { data } = await supabaseAdmin
    .from("email_campaigns" as never)
    .select("id, active, daily_limit, test_to, test_sent_at")
    .eq("id", campaignId)
    .maybeSingle();
  const campaign = data as Campaign | null;
  if (!campaign) return { ok: false, reason: "campanha não existe" };

  const { communityInviteEmail, sendViaResendOnly } = await import("@/lib/email.server");

  // Desligada: só o e-mail de teste (uma vez).
  if (!campaign.active) {
    if (!campaign.test_to || campaign.test_sent_at) return { ok: true, mode: "parada", sent: 0 };
    const { data: tu } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("email", campaign.test_to)
      .maybeSingle();
    const mail = communityInviteEmail({
      firstName: prettyFirstName(tu?.full_name?.trim().split(/\s+/)[0] ?? null),
      unsubscribeUrl: tu ? unsubscribeUrl(tu.id) : `${SITE}`,
    });
    const r = await sendViaResendOnly({ to: campaign.test_to, ...mail });
    if (r.sent) {
      await supabaseAdmin
        .from("email_campaigns" as never)
        .update({ test_sent_at: new Date().toISOString() } as never)
        .eq("id", campaignId);
    }
    return { ok: r.sent, mode: "teste", sent: r.sent ? 1 : 0 };
  }

  // Ligada: manda o lote do dia.
  const batch = (await eligibleUsers(campaignId)).slice(0, campaign.daily_limit);
  let sent = 0;
  for (const u of batch) {
    const mail = communityInviteEmail({
      firstName: prettyFirstName(u.firstName),
      unsubscribeUrl: unsubscribeUrl(u.id),
    });
    const r = await sendViaResendOnly({
      to: u.email,
      ...mail,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl(u.id)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (!r.sent) break; // provavelmente bateu o limite do dia do Resend — continua amanhã
    await supabaseAdmin
      .from("email_campaign_sends" as never)
      .insert({ campaign_id: campaignId, user_id: u.id, email: u.email } as never);
    sent++;
    await new Promise((res) => setTimeout(res, 600)); // Resend aceita ~2 por segundo
  }
  const remaining = (await eligibleUsers(campaignId)).length;
  return { ok: true, mode: "envio", sent, remaining };
}
