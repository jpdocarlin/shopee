// Controle de uso das gerações de IA (Gemini): limite anti-abuso por usuário
// autenticado + registro de uso na tabela `ai_generations`.
//
// SECURITY: só pode ser importado dentro de handlers de server function (via
// import dinâmico) — nunca no topo de uma rota ou de um *.functions.ts.
// Mesma regra dos outros módulos *.server.ts deste projeto.
//
// Usa sempre o cliente Supabase já autenticado como o próprio usuário (vindo
// do middleware `requireSupabaseAuth`, nunca `supabaseAdmin`) — assim a
// contagem e o insert respeitam a RLS de `ai_generations` (cada usuário só
// enxerga/grava o próprio uso), em vez de confiar em um user_id vindo do
// cliente.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Limite pensado só como freio anti-abuso (bot/script batendo sem parar),
// não como o limite comercial do plano — esse já existe em `plans.ai_limit`
// e pode ser aplicado depois, em cima deste mesmo registro de uso.
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_PER_WINDOW = 15;

export async function enforceAiRateLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    // Falha ao checar o limite não deve travar o usuário legítimo — só loga.
    console.error("[AI rate limit] falha ao consultar uso:", error.message);
    return;
  }

  if ((count ?? 0) >= MAX_PER_WINDOW) {
    throw new Error(
      "Você atingiu o limite de gerações de IA por agora. Espere alguns minutos e tente de novo.",
    );
  }
}

export async function logAiUsage(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    kind: string;
    model: string;
    prompt: string;
    output: string;
  },
): Promise<void> {
  const { error } = await supabase.from("ai_generations").insert({
    user_id: params.userId,
    kind: params.kind,
    model: params.model,
    // Corta pra não guardar payload gigante (ex: base64 de imagem) na linha.
    prompt: params.prompt.slice(0, 4000),
    output: params.output.slice(0, 4000),
  });
  if (error) {
    console.error("[AI usage log] falha ao registrar uso:", error.message);
  }
}
