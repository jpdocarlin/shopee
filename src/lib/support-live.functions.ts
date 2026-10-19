// Atendimento ao vivo — RPCs do painel do dono e do chat do cliente.
// SECURITY: funções do painel exigem role admin; a do cliente só devolve a
// conversa se ela for dele (conferido com user_id da sessão).
import { createServerFn } from "@tanstack/react-start";

import {
  requireSupabaseAuth,
  requireSupabaseSession,
} from "@/integrations/supabase/auth-middleware";

const UUID = /^[0-9a-f-]{36}$/i;

async function assertAdmin(userId: string) {
  const { userHasRole } = await import("@/lib/push.server");
  if (!(await userHasRole(userId, "admin"))) throw new Error("Sem permissão.");
}

export type AdminConversation = {
  id: string;
  userId: string;
  title: string | null;
  status: string;
  lastMessageAt: string;
  waiting: boolean;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    plan: string | null;
  };
};

export const adminListConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { closeStaleConversations } = await import("@/lib/support-live.server");
    await closeStaleConversations();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convs, error } = await supabaseAdmin
      .from("support_conversations")
      .select(
        "id, user_id, title, status, last_message_at, agent_last_reply_at, last_user_message_at",
      )
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não deu pra carregar as conversas.");

    const ids = [...new Set((convs ?? []).map((c) => c.user_id))];
    const [{ data: profiles }, { data: orders }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, phone, plan").in("id", ids),
      supabaseAdmin
        .from("fulfillment_requests")
        .select("user_id, submitter_name, submitter_phone, submitter_email")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    const list: AdminConversation[] = (convs ?? []).map((c) => {
      const p = profiles?.find((r) => r.id === c.user_id);
      const o = orders?.find((r) => r.user_id === c.user_id);
      const waiting =
        c.status === "human" &&
        (!c.agent_last_reply_at ||
          (!!c.last_user_message_at &&
            new Date(c.last_user_message_at).getTime() >
              new Date(c.agent_last_reply_at).getTime()));
      return {
        id: c.id,
        userId: c.user_id,
        title: c.title,
        status: c.status,
        lastMessageAt: c.last_message_at,
        waiting,
        customer: {
          name: p?.full_name || o?.submitter_name || null,
          email: p?.email || o?.submitter_email || null,
          phone: p?.phone || o?.submitter_phone || null,
          plan: p?.plan ?? null,
        },
      };
    });
    // Quem está esperando resposta vem primeiro.
    list.sort((a, b) => Number(b.waiting) - Number(a.waiting));
    return list;
  });

export const adminReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; text: string }) => {
    const text = typeof data?.text === "string" ? data.text.trim().slice(0, 4000) : "";
    if (!UUID.test(data?.conversationId ?? "") || !text) throw new Error("Mensagem vazia.");
    return { conversationId: data.conversationId, text };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("support_conversations")
      .select("id, user_id, human_since")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("support_messages").insert({
      conversation_id: conv.id,
      user_id: conv.user_id,
      role: "agent",
      kind: "text",
      content: data.text,
    });
    if (error) throw new Error("Não deu pra enviar a resposta.");
    await supabaseAdmin
      .from("support_conversations")
      .update({
        status: "human",
        human_since: conv.human_since ?? now,
        agent_last_reply_at: now,
        last_message_at: now,
        closed_at: null,
      })
      .eq("id", conv.id);
    return { ok: true };
  });

export const adminCloseConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => {
    if (!UUID.test(data?.conversationId ?? "")) throw new Error("Conversa inválida.");
    return data;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("support_conversations")
      .select("id, user_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");
    const { closeConversation } = await import("@/lib/support-live.server");
    await closeConversation(conv.id, conv.user_id);
    return { ok: true };
  });

// Chat do cliente: status + mensagens atuais da conversa (usado no polling
// enquanto o dono está atendendo, pra resposta aparecer sozinha na tela).
export const customerSyncConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .validator((data: { conversationId: string }) => {
    if (!UUID.test(data?.conversationId ?? "")) throw new Error("Conversa inválida.");
    return data;
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("support_conversations")
      .select("id, user_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.user_id !== context.userId) throw new Error("Conversa não encontrada.");

    const { closeStaleConversations } = await import("@/lib/support-live.server");
    await closeStaleConversations(conv.id);

    const [{ data: current }, { data: messages }] = await Promise.all([
      supabaseAdmin.from("support_conversations").select("status").eq("id", conv.id).single(),
      supabaseAdmin
        .from("support_messages")
        .select("id, role, kind, content, media_path, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true }),
    ]);
    return { status: current?.status ?? "open", messages: messages ?? [] };
  });
