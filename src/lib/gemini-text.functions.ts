// Server function (RPC) da mini-história do post.
// A implementação real fica em gemini-text.server.ts, carregada dinamicamente
// dentro do handler — nunca importada no topo (ver o comentário de segurança
// naquele arquivo).
//
// SECURITY: toda função de IA exige sessão válida (`requireSupabaseAuth`) e
// passa por um limite anti-abuso (`ai-usage.server.ts`) antes de chamar o
// Gemini — sem isso, qualquer script sem login conseguia gastar a cota paga
// da API direto, sem passar pela UI.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateProductStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      title: string;
      category?: string;
      priceCents?: number;
      originalPriceCents?: number | null;
      variant?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    const { generateProductStory: generate } = await import("@/lib/gemini-text.server");
    const result = await generate(data);

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "post_story",
      model: "gemini-2.5-flash",
      prompt: data.title,
      output: result.story,
    });
    return result;
  });

export const generateVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { title: string; category?: string; scenario?: string; variant?: number }) => data,
  )
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    const { generateVideoScript: generate } = await import("@/lib/gemini-text.server");
    const result = await generate(data);

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "video_script",
      model: "gemini-2.5-flash",
      prompt: data.title,
      output: result.script,
    });
    return result;
  });
