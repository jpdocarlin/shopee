// Server-only: notificação push (Web Push) pros aparelhos da conta de pedidos.
//
// As chaves VAPID são geradas uma única vez pelo próprio servidor e ficam em
// public.push_config (tabela sem policies: só o service role lê). Assim não
// precisa cadastrar chave nenhuma na Vercel, e a privada nunca vai pro cliente.
import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type VapidKeys = { publicKey: string; privateKey: string };

let cachedKeys: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;

  const { data, error } = await supabaseAdmin
    .from("push_config")
    .select("vapid_public_key, vapid_private_key")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    cachedKeys = { publicKey: data.vapid_public_key, privateKey: data.vapid_private_key };
    return cachedKeys;
  }

  // Primeira vez: gera e grava. Se duas chamadas correrem juntas, o
  // "ignoreDuplicates" deixa só a primeira gravar e a segunda relê a dela.
  const generated = webpush.generateVAPIDKeys();
  const { error: insertError } = await supabaseAdmin
    .from("push_config")
    .upsert(
      { id: 1, vapid_public_key: generated.publicKey, vapid_private_key: generated.privateKey },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (insertError) throw insertError;

  cachedKeys = null;
  const { data: saved, error: readError } = await supabaseAdmin
    .from("push_config")
    .select("vapid_public_key, vapid_private_key")
    .eq("id", 1)
    .single();
  if (readError) throw readError;
  cachedKeys = { publicKey: saved.vapid_public_key, privateKey: saved.vapid_private_key };
  return cachedKeys;
}

export async function userHasRole(userId: string, role: "admin" | "pedidos_admin") {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return Boolean(data);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Manda pra todos os aparelhos de quem tem a role pedidos_admin. Aparelho que
// a Apple/Google diz que não existe mais (404/410) sai da lista.
export async function sendToPedidosAdmins(payload: PushPayload): Promise<{ sent: number }> {
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "pedidos_admin");
  if (rolesError) throw rolesError;
  const userIds = (roles ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return { sent: 0 };

  const { data: subs, error: subsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (subsError) throw subsError;
  if (!subs || subs.length === 0) return { sent: 0 };

  const keys = await getVapidKeys();
  webpush.setVapidDetails("https://www.shoppfy.online", keys.publicKey, keys.privateKey);

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] falha ao enviar:", status, (err as Error).message);
        }
      }
    }),
  );
  return { sent };
}
