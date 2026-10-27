// Saúde da loja — RPCs da página /saude-da-loja.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type { StoreReport, ListingHealth, Suggestion } from "@/lib/store-health.server";

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
    if (!count) await collectStatsForUser(context.userId).catch(() => 0);

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
    return {
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
