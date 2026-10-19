// Server function (RPC) do atendimento — é o único ponto de entrada do CANAL
// "chat interno do Shoppfy" pro motor de atendimento (support-bot.server.ts).
// Implementação pesada fica lá, carregada dinamicamente dentro do handler —
// nunca importada no topo (mesma regra de segurança dos outros *.server.ts).
//
// SECURITY: exige sessão válida (requireSupabaseSession) e passa pelo mesmo
// limite anti-abuso das outras features de IA (ai-usage.server.ts) antes de
// chamar o Gemini — sem isso, um script sem login conseguiria gastar a cota
// paga da API direto, sem passar pela UI.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseSession } from "@/integrations/supabase/auth-middleware";

export type SendSupportMessageInput = {
  conversationId: string | null;
  kind: "text" | "image" | "audio";
  text?: string;
  // Presente quando kind é "image" ou "audio" — base64 puro (sem o prefixo
  // data:...;base64,).
  mediaBase64?: string;
  mediaMimeType?: string;
};

const BUCKET = "support-media";

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .validator((data: SendSupportMessageInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(supabase, userId);

    const { runSupportTurn, transcribeAudio, analyzeImage } =
      await import("@/lib/support-bot.server");

    // ---------- 1. garante a conversa ----------
    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: existing, error } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !existing) conversationId = null;
    }
    if (!conversationId) {
      const title =
        data.kind === "text"
          ? (data.text ?? "").slice(0, 80)
          : data.kind === "audio"
            ? "Áudio enviado"
            : "Imagem enviada";
      const { data: created, error } = await supabase
        .from("support_conversations")
        .insert({ user_id: userId, title: title || "Nova conversa" })
        .select("id")
        .single();
      if (error || !created) throw new Error("Não foi possível iniciar a conversa.");
      conversationId = created.id;
    }

    // ---------- 1b. atendimento ao vivo: fecha se passou do tempo e lê o status ----------
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { closeStaleConversations, getCustomerName, pushOwner } =
      await import("@/lib/support-live.server");
    await closeStaleConversations(conversationId);
    const { data: convState } = await supabaseAdmin
      .from("support_conversations")
      .select("status")
      .eq("id", conversationId)
      .single();
    const humanMode = convState?.status === "human";

    // ---------- 2. histórico (antes de inserir a mensagem atual) ----------
    const { data: historyRows } = await supabase
      .from("support_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = (historyRows ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ---------- 3. processa o tipo da mensagem (multimodal) ----------
    let content = (data.text ?? "").trim();
    let effectiveText = content;
    let mediaPath: string | null = null;

    if (data.kind === "audio") {
      if (!data.mediaBase64 || !data.mediaMimeType) {
        throw new Error("Áudio inválido — não veio nenhum arquivo.");
      }
      mediaPath = await uploadMedia(
        supabase,
        userId,
        conversationId,
        "audio",
        data.mediaMimeType,
        data.mediaBase64,
      );
      // Se a transcrição falhar (formato de áudio que o Gemini não aceitar,
      // por exemplo), não derruba a conversa inteira — vira uma mensagem que
      // o próprio motor de atendimento sabe responder pedindo pra reenviar.
      try {
        const transcript = await transcribeAudio(data.mediaBase64, data.mediaMimeType);
        content = transcript;
        effectiveText =
          transcript === "[ININTELIGIVEL]"
            ? "O cliente mandou um áudio, mas não deu pra entender o que foi dito."
            : transcript;
      } catch (err) {
        console.error("[Support bot] falha ao transcrever áudio:", err);
        content = "[áudio enviado — não foi possível transcrever]";
        effectiveText = "O cliente mandou um áudio, mas não foi possível transcrever agora.";
      }
    } else if (data.kind === "image") {
      if (!data.mediaBase64 || !data.mediaMimeType) {
        throw new Error("Imagem inválida — não veio nenhum arquivo.");
      }
      mediaPath = await uploadMedia(
        supabase,
        userId,
        conversationId,
        "image",
        data.mediaMimeType,
        data.mediaBase64,
      );
      content = content || "(imagem enviada)";
      try {
        const description = await analyzeImage(data.mediaBase64, data.mediaMimeType);
        effectiveText = `${content}\n[Descrição da imagem enviada: ${description}]`;
      } catch (err) {
        console.error("[Support bot] falha ao analisar imagem:", err);
        effectiveText = `${content}\n[O cliente enviou uma imagem, mas não foi possível analisá-la agora.]`;
      }
    }

    if (!effectiveText.trim()) {
      throw new Error("Mensagem vazia.");
    }

    // ---------- 4. loga a mensagem do cliente ----------
    const { data: userMessage, error: userMsgError } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        kind: data.kind,
        content,
        media_path: mediaPath,
      })
      .select("id")
      .single();
    if (userMsgError || !userMessage) throw new Error("Não foi possível registrar sua mensagem.");

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("support_conversations")
      .update({ last_user_message_at: nowIso, last_message_at: nowIso })
      .eq("id", conversationId);

    // ---------- 4b. dono já está atendendo: bot fica quieto, só avisa o dono ----------
    if (humanMode) {
      const name = await getCustomerName(userId);
      await pushOwner({
        conversationId,
        title: `${name} respondeu`,
        body: effectiveText,
      });
      return {
        conversationId,
        reply: null as string | null,
        intent: null,
        escalated: true,
        human: true,
      };
    }

    // ---------- 5. motor de atendimento ----------
    const result = await runSupportTurn({
      admin: supabaseAdmin,
      userId,
      history,
      effectiveText,
    });

    // RLS não deixa o cliente dar UPDATE nas próprias mensagens — grava a
    // categoria pelo servidor (antes ficava sempre vazia).
    await supabaseAdmin
      .from("support_messages")
      .update({ intent: result.intent })
      .eq("id", userMessage.id);

    await supabase.from("support_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      kind: "text",
      content: result.reply,
    });

    await supabase
      .from("support_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", conversationId);

    // Guarda telefone/nome que o cliente informou no chat (só preenche vazio).
    const patch: { phone?: string; full_name?: string } = {};
    if (result.extracted.phone && !result.customer.phone) patch.phone = result.extracted.phone;
    if (result.extracted.name && !result.customer.name) patch.full_name = result.extracted.name;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
    }

    if (result.escalated) {
      const contact = {
        name: patch.full_name ?? result.customer.name,
        email: result.customer.email,
        phone: patch.phone ?? result.customer.phone,
      };
      const summary = [
        `Cliente: ${contact.name ?? "sem nome"} · ${contact.email ?? "sem e-mail"} · ${contact.phone ?? "sem telefone"}.`,
        `Pediu: "${effectiveText.slice(0, 220)}".`,
        `Motivo: ${result.escalationReason ?? "não informado"}.`,
      ].join(" ");

      await supabase.from("support_escalations").insert({
        conversation_id: conversationId,
        user_id: userId,
        reason: result.escalationReason ?? "não informado",
        summary,
      });

      // Dono assume a conversa: a partir daqui o bot fica em silêncio e as
      // mensagens do cliente chegam como notificação pra ele responder no painel.
      await supabaseAdmin
        .from("support_conversations")
        .update({
          status: "human",
          human_since: new Date().toISOString(),
          agent_last_reply_at: null,
        })
        .eq("id", conversationId);
      await pushOwner({
        conversationId,
        title: `${contact.name ?? contact.email ?? "Cliente"} está esperando resposta`,
        body: effectiveText,
        minIntervalMs: 0,
      });
    }

    // Pergunta que o manual não cobre — fila pra eu (dono) completar o manual.
    if (!result.covered) {
      await supabase.from("support_unanswered_questions").insert({
        conversation_id: conversationId,
        user_id: userId,
        question: effectiveText.slice(0, 500),
        context: result.reply.slice(0, 500),
        category: result.intent,
      });
    }

    await logAiUsage(supabase, {
      userId,
      kind: "support_chat",
      model: "gemini-3.6-flash",
      prompt: effectiveText,
      output: result.reply,
    });

    return {
      conversationId,
      reply: result.reply,
      intent: result.intent,
      escalated: result.escalated,
      human: result.escalated,
    };
  });

async function uploadMedia(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  conversationId: string,
  kind: "image" | "audio",
  mimeType: string,
  base64: string,
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
  const path = `${userId}/${conversationId}/${Date.now()}-${kind}.${ext}`;
  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.error("[Support bot] falha ao subir mídia:", error.message);
    return "";
  }
  return path;
}
