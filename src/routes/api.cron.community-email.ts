import { createFileRoute } from "@tanstack/react-router";

// Cron diário: manda o próximo lote do convite da Comunidade Shoppfy.
// Com a campanha desligada, só manda o e-mail de teste (uma vez).
export const Route = createFileRoute("/api/cron/community-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runCommunityCampaign } = await import("@/lib/email-campaign.server");
          return Response.json(await runCommunityCampaign());
        } catch (err) {
          console.error("[community-email] falhou:", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
