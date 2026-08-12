// Server functions (RPC) para geração de imagem com IA.
// Implementação real fica em gemini-image.server.ts, carregada dinamicamente
// dentro do handler — nunca importada no topo do arquivo (ver o comentário
// de segurança em gemini-image.server.ts).
//
// SECURITY: toda função de IA exige sessão válida (`requireSupabaseAuth`) e
// passa por um limite anti-abuso (`ai-usage.server.ts`) antes de chamar o
// Gemini — sem isso, qualquer script sem login conseguia gastar a cota paga
// da API direto, sem passar pela UI.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string; category: string }) => data)
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    const { generateProductPhoto: generate } = await import("@/lib/gemini-image.server");
    const result = await generate(data);

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "product_photo",
      model: "gemini-2.5-flash-image",
      prompt: data.title,
      output: "[imagem gerada]",
    });
    return result;
  });

export const generateEnhancedProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string; category?: string; productImageUrl: string }) => data)
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    const { generateEnhancedProductPhoto: generate } = await import("@/lib/gemini-image.server");
    const result = await generate(data);

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "enhanced_photo",
      model: "gemini-2.5-flash-image",
      prompt: data.title,
      output: "[imagem gerada]",
    });
    return result;
  });

export const generateVideoScenePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      title: string;
      category: string;
      productImageUrl: string;
      scenarioId: string;
      customScenario?: string;
      genderId: string;
      shotTypeId: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    const { generateVideoScenePhoto: generate } = await import("@/lib/gemini-image.server");
    const result = await generate(data);

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "video_scene_photo",
      model: "gemini-2.5-flash-image",
      prompt: data.title,
      output: "[imagem gerada]",
    });
    return result;
  });
