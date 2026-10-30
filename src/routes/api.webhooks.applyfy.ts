import { createFileRoute } from "@tanstack/react-router";

import {
  handleAccessBlock,
  handleSubscriptionActive,
  handleTransactionPaid,
  verifyApplyfyToken,
  type ApplyfyPayload,
  type WebhookResult,
} from "@/lib/applyfy-webhook.server";

// Webhook da Applyfy (plataforma de vendas da Shoppfy). Configurado em
// Applyfy → Integrações → Webhooks → "Shoppfy - login automático", apontando pra
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
        {
          const { recordApplyfyEvent } = await import("@/lib/addons.server");
          await recordApplyfyEvent(payload as Record<string, unknown>);
        }

        try {
          let result: WebhookResult;
          switch (payload.event) {
            // Compra nova ou renovação do mensal: cria o login (se preciso) e libera.
            case "TRANSACTION_PAID":
              result = await handleTransactionPaid(payload);
              break;
            case "SUBSCRIPTION_STARTED":
            case "SUBSCRIPTION_RENEWED":
              result = await handleSubscriptionActive(payload);
              break;
            // Cancelou o mensal: continua com acesso até a próxima cobrança.
            case "SUBSCRIPTION_CANCELED":
              result = await handleAccessBlock(payload, "subscription_canceled");
              break;
            // Não renovou (ex.: PIX da renovação expirou): bloqueia na hora.
            case "SUBSCRIPTION_EXPIRED":
              result = await handleAccessBlock(payload, "subscription_expired");
              break;
            // Reembolso e chargeback: bloqueia (não apaga mais a conta nem os pedidos).
            case "TRANSACTION_REFUNDED": {
              // Reembolso só do extra (ex.: a call comprada depois): tira o
              // extra e NÃO bloqueia o acesso ao sistema.
              const txId = payload.transaction?.id?.trim();
              const { revokeAddonOnlyTransaction } = await import("@/lib/addons.server");
              if (txId && (await revokeAddonOnlyTransaction(txId))) {
                result = { ok: true, ignored: "addon_refunded" };
                break;
              }
              result = await handleAccessBlock(payload, "refunded");
              break;
            }
            case "TRANSACTION_CHARGED_BACK":
              result = await handleAccessBlock(payload, "chargeback");
              break;
            default:
              // Outros eventos (ex.: transação criada, disputa aberta) não mexem no acesso.
              return Response.json({ ok: true, ignored: payload.event ?? null });
          }

          if (!result.ok) console.error(`[applyfy-webhook] ${payload.event} failed:`, result);
          else console.log(`[applyfy-webhook] ${payload.event} ok:`, result);
          return Response.json(result, { status: result.ok ? 200 : 400 });
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
