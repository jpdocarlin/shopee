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

export const generateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      productTitle: string;
      category?: string;
      marketplace: "shopee" | "mercado-livre";
      variant?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { enforceAiRateLimit, logAiUsage } = await import("@/lib/ai-usage.server");
    await enforceAiRateLimit(context.supabase, context.userId);

    // 1ª geração do mesmo produto pelo mesmo cliente: reaproveita o texto
    // salvo (não gasta IA). "Gerar outra versão" (variant > 0) sempre gera.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const productKey = data.productTitle.trim().toLowerCase().slice(0, 300);
    const cache = () => supabaseAdmin.from("listing_text_cache" as never);
    if (!data.variant) {
      const { data: hit } = await cache()
        .select("payload, created_at")
        .eq("user_id", context.userId)
        .eq("marketplace", data.marketplace)
        .eq("product_key", productKey)
        .maybeSingle();
      const row = hit as { payload: unknown; created_at: string } | null;
      if (row && Date.now() - new Date(row.created_at).getTime() < 30 * 86400000) {
        return row.payload as Awaited<
          ReturnType<(typeof import("@/lib/gemini-text.server"))["generateListing"]>
        >;
      }
    }

    const { generateListing: generate } = await import("@/lib/gemini-text.server");
    const result = await generate(data);
    if (!data.variant) {
      await cache()
        .upsert(
          {
            user_id: context.userId,
            marketplace: data.marketplace,
            product_key: productKey,
            payload: result,
            created_at: new Date().toISOString(),
          } as never,
          { onConflict: "user_id,marketplace,product_key" },
        )
        .then(
          () => undefined,
          () => undefined,
        );
    }

    await logAiUsage(context.supabase, {
      userId: context.userId,
      kind: "listing",
      model: "gemini-2.5-flash",
      prompt: data.productTitle,
      output: result.title,
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
