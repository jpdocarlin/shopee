import { createFileRoute } from "@tanstack/react-router";

import {
  handleTransactionPaid,
  handleTransactionRefunded,
  verifyApplyfyToken,
  type ApplyfyPayload,
} from "@/lib/applyfy-webhook.server";

// Webhook da Applyfy (plataforma de vendas da Shoppfy). Configurado em
// Applyfy → Integrações → Webhooks → "Shoppfy - login automático", eventos
// "Transação paga" e "Transação estornada", apontando pra
// https://www.shoppfy.online/api/webhooks/applyfy
// IMPORTANTE: precisa ser o domínio COM "www" — o certificado SSL de
// shoppfy.online (sem www) não cobre o domínio puro, o que faz a Applyfy
// (chamada servidor-pra-servidor) falhar no handshake TLS antes mesmo de
// chegar aqui. Foi exatamente esse o motivo do webhook "não funcionar".
export const Route = createFileRoute("/api/webhooks/applyfy")({
  server: {
    handlers: {
      // Muitos painéis de webhook (a Applyfy inclusive, aparentemente) fazem
      // um GET/ping na URL só pra confirmar que ela responde antes de salvar
      // — sem esse handler, esse ping caía na SPA e voltava como página 404
      // "Page not found", o que parecia (mas não era) o webhook quebrado.
      GET: () => Response.json({ ok: true, service: "applyfy-webhook" }),
      POST: async ({ request }) => {
        let payload: ApplyfyPayload;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        let tokenOk: boolean;
        try {
          tokenOk = verifyApplyfyToken(payload);
        } catch (err) {
          console.error("[applyfy-webhook] config error:", err);
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!tokenOk) {
          return new Response("Invalid token", { status: 401 });
        }

        // Log de auditoria: sem isso, uma falha silenciosa (env var faltando,
        // evento com nome diferente do esperado, etc.) não deixa nenhum
        // rastro nos logs da Vercel, e o único sinal é "o login não foi
        // criado" — dias depois, sem contexto nenhum pra investigar.
        console.log("[applyfy-webhook] received event:", payload.event ?? "(sem event)");

        try {
          switch (payload.event) {
            case "TRANSACTION_PAID": {
              const result = await handleTransactionPaid(payload);
              if (!result.ok) console.error("[applyfy-webhook] TRANSACTION_PAID failed:", result);
              else
                console.log("[applyfy-webhook] TRANSACTION_PAID ok:", result.userId, result.plan);
              return Response.json(result, { status: result.ok ? 200 : 400 });
            }
            case "TRANSACTION_REFUNDED": {
              const result = await handleTransactionRefunded(payload);
              if (!result.ok)
                console.error("[applyfy-webhook] TRANSACTION_REFUNDED failed:", result);
              return Response.json(result, { status: result.ok ? 200 : 400 });
            }
            default:
              // Outros eventos (ex: chargeback) não foram pedidos — ignora sem erro.
              return Response.json({ ok: true, ignored: payload.event ?? null });
          }
        } catch (err) {
          // Pega qualquer erro inesperado (ex: env var de service role faltando
          // em produção) que antes derrubava a função sem log nenhum — agora
          // fica registrado e a Applyfy recebe um 500 claro (pra ela poder
          // reenviar), em vez de um crash silencioso.
          console.error("[applyfy-webhook] unexpected error:", err);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
