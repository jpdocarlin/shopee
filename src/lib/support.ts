// Atendimento — leitura/escrita que não envolve segredo de servidor nenhum
// (a RLS de cada tabela já decide sozinha o que a conta enxerga: usuário
// comum só vê o próprio histórico, admin vê tudo). Mesmo padrão já usado
// por fulfillment.ts pro resto do app — envio de mensagem em si (que chama
// o Gemini) é a única parte que precisa de server function, em
// support-bot.functions.ts.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SupportConversation = Database["public"]["Tables"]["support_conversations"]["Row"];
export type SupportMessage = Database["public"]["Tables"]["support_messages"]["Row"];
export type SupportKnowledgeEntry = Database["public"]["Tables"]["support_knowledge_base"]["Row"];
export type SupportEscalation = Database["public"]["Tables"]["support_escalations"]["Row"];
export type SupportUnansweredQuestion =
  Database["public"]["Tables"]["support_unanswered_questions"]["Row"];

export const KNOWLEDGE_CATEGORIES = [
  "geral",
  "como_usar",
  "produto",
  "shopee",
  "afiliados",
  "fornecedor",
  "pedidos",
  "criar_anuncio",
  "ia",
  "videos",
  "pagamento",
  "plano",
  "creditos_limites",
  "login_acesso",
  "erro_tecnico",
  "reembolso",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  geral: "Geral",
  como_usar: "Como usar",
  produto: "Produto",
  shopee: "Shopee",
  afiliados: "Afiliados",
  fornecedor: "Fornecedor",
  pedidos: "Pedidos",
  criar_anuncio: "Criar Anúncio",
  ia: "IA",
  videos: "Vídeos",
  pagamento: "Pagamento",
  plano: "Plano",
  creditos_limites: "Créditos / limites",
  login_acesso: "Login / acesso",
  erro_tecnico: "Erro técnico",
  reclamacao: "Reclamação",
  reembolso: "Reembolso",
  pre_venda: "Pré-venda",
  atendimento_humano: "Atendimento humano",
  duvida_geral: "Dúvida geral",
};

// ---------- conversas do próprio usuário (widget de chat) ----------

export async function listMyConversations(): Promise<SupportConversation[]> {
  const { data, error } = await supabase
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function listConversationMessages(conversationId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getMediaSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("support-media")
    .createSignedUrl(path, 60 * 10);
  if (error) {
    console.error("[support] falha ao gerar link da mídia:", error.message);
    return null;
  }
  return data.signedUrl;
}

// ---------- painel admin (RLS libera só pra role 'admin') ----------

export async function listAllConversations(): Promise<SupportConversation[]> {
  const { data, error } = await supabase
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function listEscalations(
  status?: SupportEscalation["status"],
): Promise<SupportEscalation[]> {
  let query = supabase
    .from("support_escalations")
    .select("*")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateEscalationStatus(
  id: string,
  status: SupportEscalation["status"],
): Promise<void> {
  const { error } = await supabase
    .from("support_escalations")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function listUnansweredQuestions(
  onlyPending = true,
): Promise<SupportUnansweredQuestion[]> {
  let query = supabase
    .from("support_unanswered_questions")
    .select("*")
    .order("created_at", { ascending: false });
  if (onlyPending) query = query.eq("reviewed", false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function markUnansweredReviewed(id: string): Promise<void> {
  const { error } = await supabase
    .from("support_unanswered_questions")
    .update({ reviewed: true })
    .eq("id", id);
  if (error) throw error;
}

// ---------- base de conhecimento (CRUD, só admin escreve) ----------

export async function listKnowledgeBase(): Promise<SupportKnowledgeEntry[]> {
  const { data, error } = await supabase
    .from("support_knowledge_base")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createKnowledgeEntry(params: {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}): Promise<SupportKnowledgeEntry> {
  const { data, error } = await supabase
    .from("support_knowledge_base")
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateKnowledgeEntry(
  id: string,
  params: Partial<{
    category: string;
    question: string;
    answer: string;
    keywords: string[];
    is_active: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase.from("support_knowledge_base").update(params).eq("id", id);
  if (error) throw error;
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const { error } = await supabase.from("support_knowledge_base").delete().eq("id", id);
  if (error) throw error;
}

// ---------- métricas simples pro painel ----------

export type SupportStats = {
  totalConversations: number;
  openConversations: number;
  escalatedConversations: number;
  pendingEscalations: number;
  unreviewedUnanswered: number;
  resolutionRate: number; // 0..1
  topIntents: Array<{ intent: string; count: number }>;
};

export async function getSupportStats(): Promise<SupportStats> {
  const [conversations, pendingEscalations, unanswered, recentIntents] = await Promise.all([
    supabase.from("support_conversations").select("status"),
    supabase
      .from("support_escalations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("support_unanswered_questions")
      .select("id", { count: "exact", head: true })
      .eq("reviewed", false),
    supabase
      .from("support_messages")
      .select("intent")
      .eq("role", "user")
      .not("intent", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows = conversations.data ?? [];
  const total = rows.length;
  const open = rows.filter((r) => r.status === "open").length;
  const escalated = rows.filter((r) => r.status === "escalated").length;
  const resolved = rows.filter((r) => r.status === "resolved").length;

  const intentCounts = new Map<string, number>();
  for (const row of recentIntents.data ?? []) {
    if (!row.intent) continue;
    intentCounts.set(row.intent, (intentCounts.get(row.intent) ?? 0) + 1);
  }
  const topIntents = [...intentCounts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalConversations: total,
    openConversations: open,
    escalatedConversations: escalated,
    pendingEscalations: pendingEscalations.count ?? 0,
    unreviewedUnanswered: unanswered.count ?? 0,
    resolutionRate: total > 0 ? resolved / total : 0,
    topIntents,
  };
}
