// Server-only: atendimento ao vivo (dono ↔ cliente na mesma conversa).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AUTO_CLOSE_MINUTES = 10;

export const CLOSED_MESSAGE =
  "Atendimento finalizado. Se precisar de mais alguma coisa, é só mandar mensagem aqui.";

// Finaliza conversas em que o dono respondeu e o cliente ficou 10 min sem
// responder. Roda "preguiçosamente" sempre que alguém abre/usa o atendimento
// (painel do dono, chat do cliente) — não precisa de cron.
export async function closeStaleConversations(conversationId?: string): Promise<void> {
  const limit = new Date(Date.now() - AUTO_CLOSE_MINUTES * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from("support_conversations")
    .select("id, user_id, agent_last_reply_at, last_user_message_at")
    .eq("status", "human")
    .not("agent_last_reply_at", "is", null)
    .lt("agent_last_reply_at", limit);
  if (conversationId) query = query.eq("id", conversationId);
  const { data } = await query.limit(50);

  const stale = (data ?? []).filter(
    (c) =>
      !c.last_user_message_at ||
      new Date(c.last_user_message_at).getTime() <
        new Date(c.agent_last_reply_at as string).getTime(),
  );
  for (const c of stale) {
    await closeConversation(c.id, c.user_id);
  }
}

export async function closeConversation(conversationId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: updated } = await supabaseAdmin
    .from("support_conversations")
    .update({ status: "closed", closed_at: now, last_message_at: now })
    .eq("id", conversationId)
    .neq("status", "closed")
    .select("id");
  if (!updated || updated.length === 0) return;
  await supabaseAdmin.from("support_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "system",
    kind: "text",
    content: CLOSED_MESSAGE,
  });
}

export async function getCustomerName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.email?.split("@")[0] || "Cliente";
}

// Avisa o dono no celular. Throttle por conversa pra não virar spam quando o
// cliente manda várias mensagens seguidas.
const lastPushByConversation = new Map<string, number>();

export async function pushOwner(params: {
  conversationId: string;
  title: string;
  body: string;
  minIntervalMs?: number;
}): Promise<void> {
  const now = Date.now();
  const last = lastPushByConversation.get(params.conversationId) ?? 0;
  if (now - last < (params.minIntervalMs ?? 60_000)) return;
  lastPushByConversation.set(params.conversationId, now);
  try {
    const { sendToPedidosAdmins } = await import("@/lib/push.server");
    await sendToPedidosAdmins({
      title: params.title,
      body: params.body.slice(0, 160),
      url: `/atendimento-admin?c=${params.conversationId}`,
      tag: `atendimento-${params.conversationId}`,
    });
  } catch (err) {
    console.error("[support-live] falha ao notificar o dono:", err);
  }
}
