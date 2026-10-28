import { createFileRoute } from "@tanstack/react-router";

// Usado só pela extensão "Shoppfy → C7" (conta de pedidos): troca o passe
// gerado pelo botão "Comprar na C7" pelos dados do pedido — produto,
// variação, quantidade, dados do lojista e link temporário da etiqueta.
// Nunca devolve nada sem um passe válido e dentro dos 30 minutos.
const CORS = {
  "access-control-allow-origin": "https://www.c7drop.com.br",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
};

export const Route = createFileRoute("/api/c7-handoff")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!/^[0-9a-f]{64}$/.test(token)) {
          return Response.json({ error: "Passe inválido." }, { status: 400, headers: CORS });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: h } = await supabaseAdmin
          .from("c7_handoffs" as never)
          .select("token, request_id, expires_at, first_used_at")
          .eq("token", token)
          .maybeSingle();
        const handoff = h as {
          request_id: string;
          expires_at: string;
          first_used_at: string | null;
        } | null;
        if (!handoff || new Date(handoff.expires_at).getTime() < Date.now()) {
          return Response.json(
            { error: "Esse passe expirou. Clique em “Comprar na C7” de novo." },
            { status: 410, headers: CORS },
          );
        }
        const { data: r } = await supabaseAdmin
          .from("fulfillment_requests")
          .select("*")
          .eq("id", handoff.request_id)
          .maybeSingle();
        const req = r as
          | (Record<string, unknown> & {
              product_id: string | null;
              product_name: string;
              submitter_name: string;
              submitter_email: string;
              submitter_phone: string;
              submitter_person_type: "fisica" | "juridica";
              submitter_document: string;
              label_path: string | null;
              variation?: string | null;
              quantity?: number | null;
            })
          | null;
        if (!req) {
          return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: CORS });
        }
        const { C7DROP_PRODUCTS } = await import("@/data/c7drop-products");
        const product = C7DROP_PRODUCTS.find((p) => p.id === req.product_id);

        let label: { url: string; filename: string } | null = null;
        if (req.label_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("fulfillment-attachments")
            .createSignedUrl(req.label_path, 15 * 60);
          if (signed?.signedUrl) {
            label = {
              url: signed.signedUrl,
              filename:
                req.label_path
                  .split("/")
                  .pop()
                  ?.replace(/^label-/, "") || "etiqueta.pdf",
            };
          }
        }
        if (!handoff.first_used_at) {
          await supabaseAdmin
            .from("c7_handoffs" as never)
            .update({ first_used_at: new Date().toISOString() } as never)
            .eq("token", token);
        }

        const parts = req.submitter_name.trim().split(/\s+/);
        return Response.json(
          {
            productName: req.product_name,
            slug: product?.slug ?? null,
            variation: req.variation ?? null,
            quantity: req.quantity ?? 1,
            submitter: {
              firstName: parts[0] ?? "",
              lastName: parts.slice(1).join(" "),
              email: req.submitter_email,
              phone: req.submitter_phone,
              personType: req.submitter_person_type,
              document: req.submitter_document,
            },
            label,
            expiresAt: handoff.expires_at,
          },
          { headers: CORS },
        );
      },
    },
  },
});
