import { createFileRoute } from "@tanstack/react-router";

// Cron (Vercel, a cada 10 min): importa as vendas novas da Shopee e do ML de
// todos os clientes com loja conectada e avisa cada um no celular.
// Idempotente: cada venda entra uma vez só. Com CRON_SECRET na Vercel, exige
// o header que a própria Vercel manda.
export const Route = createFileRoute("/api/cron/import-orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { importOrdersForAll } = await import("@/lib/order-import.server");
          return Response.json({ ok: true, ...(await importOrdersForAll()) });
        } catch (err) {
          console.error("[import-orders] falhou:", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
