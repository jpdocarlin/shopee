import { createFileRoute } from "@tanstack/react-router";

// Cron semanal (segunda, 9h de Brasília): manda o recap da semana anterior
// por e-mail e push. Cada cliente recebe uma vez por semana (weekly_recaps).
export const Route = createFileRoute("/api/cron/weekly-recap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { sendWeeklyRecapsForAll } = await import("@/lib/store-health.server");
          return Response.json({ ok: true, ...(await sendWeeklyRecapsForAll()) });
        } catch (err) {
          console.error("[weekly-recap] falhou:", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
