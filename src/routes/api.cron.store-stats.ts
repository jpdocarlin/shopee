import { createFileRoute } from "@tanstack/react-router";

// Cron diário (madrugada): guarda a foto do dia das visitas/vendas de cada
// anúncio de todos os clientes. Idempotente (uma linha por anúncio por dia).
export const Route = createFileRoute("/api/cron/store-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { collectStatsForAll } = await import("@/lib/store-health.server");
          return Response.json({ ok: true, ...(await collectStatsForAll()) });
        } catch (err) {
          console.error("[store-stats] falhou:", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
