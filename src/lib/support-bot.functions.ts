// Server function (RPC) do atendimento — é o único ponto de entrada do CANAL
// "chat interno do Shoppfy" pro motor de atendimento (support-bot.server.ts).
// Implementação pesada fica lá, carregada dinamicamente dentro do handler —
// nunca importada no topo (mesma regra de segurança dos outros *.server.ts).
//
// SECURITY: exige sessão válida (requireSupabaseAuth) e passa pelo mesmo
// limite anti-abuso das outras features de IA (ai-usage.server.ts) antes de
// chamar o Gemini — sem isso, um script sem login conseguiria gastar a cota
// paga da API direto, sem passar pela UI.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
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

    // ---------- 5. motor de atendimento ----------
    const result = await runSupportTurn({ supabase, userId, history, effectiveText });

    await supabase
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
        status: result.escalated ? "escalated" : "open",
      })
      .eq("id", conversationId);

    if (result.escalated) {
      const summary = [
        `Cliente perguntou: "${effectiveText.slice(0, 220)}".`,
        `Categoria: ${result.intent}.`,
        `${result.kbMatchCount} fato(s) da base de conhecimento encontrados.`,
        `Motivo do encaminhamento: ${result.escalationReason ?? "não informado"}.`,
      ].join(" ");
      await supabase.from("support_escalations").insert({
        conversation_id: conversationId,
        user_id: userId,
        reason: result.escalationReason ?? "não informado",
        summary,
      });
    }

    // Nenhum fato da base ajudou — vira fila de "perguntas sem resposta" pra
    // eu (dono) revisar e transformar em conhecimento novo depois.
    if (result.kbMatchCount === 0) {
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
