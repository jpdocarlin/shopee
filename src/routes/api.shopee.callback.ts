import { createFileRoute } from "@tanstack/react-router";

// Callback do OAuth da Shopee — recebe ?code&shop_id&state, troca code por
// access_token/refresh_token e salva na conta de quem iniciou a conexão. O
// `state` é um token de uso único criado em /api/shopee/connect (via
// createShopeeOAuthState, autenticado) — é assim que a gente sabe pra qual
// usuário salvar os tokens, já que esse callback é um redirect puro do
// navegador (sem Authorization header). Depois manda de volta pra
// Integrações com um aviso de sucesso/erro.
export const Route = createFileRoute("/api/shopee/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { afterConnectRedirect } = await import("@/lib/connect-redirect.server");
        const code = url.searchParams.get("code");
        const shopIdRaw = url.searchParams.get("shop_id");
        const state = url.searchParams.get("state");
        if (!code || !shopIdRaw || !state) {
          return afterConnectRedirect(
            request,
            "shopee",
            false,
            "shopee=error&reason=missing_params",
          );
        }
        try {
          const { exchangeCodeForToken } = await import("@/lib/shopee-api.server");
          const { saveShopeeConnection, consumeShopeeOAuthState } =
            await import("@/lib/shopee-connection.server");
          const userId = await consumeShopeeOAuthState(state);
          const tokens = await exchangeCodeForToken(code, Number(shopIdRaw));
          await saveShopeeConnection(tokens, userId);
          console.log("[shopee-callback] loja conectada:", tokens.shopId);
          return afterConnectRedirect(request, "shopee", true, "shopee=connected");
        } catch (err) {
          console.error("[shopee-callback] falha ao conectar:", err);
          return afterConnectRedirect(request, "shopee", false, "shopee=error");
        }
      },
    },
  },
});
