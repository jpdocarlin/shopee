import { createFileRoute } from "@tanstack/react-router";

// Chamado pelo cron da Vercel (vercel.json → crons, a cada 10 min). Compara o
// catálogo deste deploy com o último já avisado e manda push das diferenças.
// Pode ser chamado mais de uma vez sem problema: cada versão do catálogo é
// avisada uma vez só (trava no banco). Se CRON_SECRET estiver configurado na
// Vercel, exige o header que a própria Vercel manda.
export const Route = createFileRoute("/api/cron/catalog-notify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runCatalogNotify } = await import("@/lib/catalog-notify.server");
          const result = await runCatalogNotify();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[catalog-notify] falhou:", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
