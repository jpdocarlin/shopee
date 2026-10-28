// Saúde da loja — RPCs da página /saude-da-loja.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type {
  StoreReport,
  ListingHealth,
  Suggestion,
  ChannelReport,
  ReviewItem,
} from "@/lib/store-health.server";
export type {
  StoreInsights,
  Reputation,
  StoreScore,
  StaleListing,
  MlQuality,
  Opportunity,
  WeeklyTask,
} from "@/lib/store-insights.server";

export const getStoreHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { days: number }) => ({
    days: [7, 30].includes(Number(data?.days)) ? Number(data.days) : 7,
  }))
  .handler(async ({ context, data }) => {
    const { brDay, buildStoreReport, collectStatsForUser } =
      await import("@/lib/store-health.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Garante a foto de hoje (o cron também faz de madrugada).
    const today = brDay();
    const { count } = await supabaseAdmin
      .from("listing_daily_stats")
      .select("listing_id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("day", today);
    const { count: shopCount } = await supabaseAdmin
      .from("store_daily_stats" as never)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("day", today);
    if (!count || !shopCount) await collectStatsForUser(context.userId).catch(() => 0);

    const to = today;
    const from = new Date(new Date(`${to}T12:00:00Z`).getTime() - (data.days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    const report = await buildStoreReport(context.userId, from, to);
    const { data: recaps } = await supabaseAdmin
      .from("weekly_recaps")
      .select("week_number, week_start, payload")
      .eq("user_id", context.userId)
      .order("week_start", { ascending: false })
      .limit(12);
    // Lojas conectadas — o Dashboard mostra só o card de quem está conectado.
    const [{ getShopeeConnection }, { getMercadoLivreConnection }] = await Promise.all([
      import("@/lib/shopee-connection.server"),
      import("@/lib/mercadolivre-connection.server"),
    ]);
    const [shopee, ml] = await Promise.all([
      getShopeeConnection(context.userId).catch(() => null),
      getMercadoLivreConnection(context.userId).catch(() => null),
    ]);
    const connected = [
      ...(shopee ? ["shopee" as const] : []),
      ...(ml ? ["mercado-livre" as const] : []),
    ];
    return {
      connected,
      report,
      recaps: (recaps ?? []).map((r) => {
        const p = r.payload as {
          visits: number | null;
          orders: number;
          revenueCents: number;
          profitCents: number;
        };
        return {
          weekNumber: r.week_number,
          weekStart: r.week_start,
          visits: p.visits,
          orders: p.orders,
          revenueCents: p.revenueCents,
          profitCents: p.profitCents,
        };
      }),
    };
  });

// Saúde da loja v2: reputação, nota, parados, qualidade ML, oportunidades e
// tarefas da semana. Separado do getStoreHealth porque chama mais APIs.
export const getStoreInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ buildStoreInsights }, { getShopeeConnection }, { getMercadoLivreConnection }] =
      await Promise.all([
        import("@/lib/store-insights.server"),
        import("@/lib/shopee-connection.server"),
        import("@/lib/mercadolivre-connection.server"),
      ]);
    const [shopee, ml] = await Promise.all([
      getShopeeConnection(context.userId).catch(() => null),
      getMercadoLivreConnection(context.userId).catch(() => null),
    ]);
    const connected = [
      ...(shopee ? ["shopee" as const] : []),
      ...(ml ? ["mercado-livre" as const] : []),
    ];
    return buildStoreInsights(context.userId, connected);
  });

export const setWeeklyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; done: boolean }) => ({
    id: String(data?.id ?? ""),
    done: Boolean(data?.done),
  }))
  .handler(async ({ context, data }) => {
    const { setWeeklyTaskDone } = await import("@/lib/store-insights.server");
    await setWeeklyTaskDone(context.userId, data.id, data.done);
    return { ok: true };
  });
