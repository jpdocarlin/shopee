import { createFileRoute } from "@tanstack/react-router";

// "Sair da lista" dos e-mails de divulgação (link assinado no rodapé).
const page = (msg: string) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shoppfy</title></head><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b"><div style="max-width:480px;margin:60px auto;background:#fff;border-radius:12px;padding:28px"><p style="font-size:20px;font-weight:bold;color:#ff6a00;margin:0 0 12px">Shoppfy</p><p style="font-size:16px;line-height:24px;margin:0">${msg}</p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

async function handle(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  const { verifyUnsubscribe } = await import("@/lib/email-campaign.server");
  if (!/^[0-9a-f-]{36}$/i.test(u) || !verifyUnsubscribe(u, t)) {
    return page("Esse link não é válido.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("email_unsubscribes" as never)
    .upsert({ user_id: u } as never, { onConflict: "user_id" });
  return page(
    "Pronto! Você não vai mais receber nossos e-mails de novidades. Os avisos do sistema (como reembolso) continuam chegando normalmente.",
  );
}

export const Route = createFileRoute("/api/email/sair")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request), // "one-click" do Gmail
    },
  },
});
