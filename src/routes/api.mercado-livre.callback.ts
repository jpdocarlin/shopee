import { createFileRoute } from "@tanstack/react-router";

// Callback do OAuth do Mercado Livre — recebe ?code&state, troca code por
// access_token/refresh_token e salva na conta de quem iniciou a conexão.
// Espelha api.shopee.callback.ts. O `state` aqui é o parâmetro OAuth padrão
// (não embutido no redirect_uri, ver nota em api.mercado-livre.connect.ts) —
// o próprio Mercado Livre devolve ele de volta como query param ao lado do
// `code`.
export const Route = createFileRoute("/api/mercado-livre/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { afterConnectRedirect } = await import("@/lib/connect-redirect.server");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return afterConnectRedirect(
            request,
            "mercado-livre",
            false,
            "ml=error&reason=missing_params",
          );
        }
        try {
          const { exchangeCodeForToken } = await import("@/lib/mercadolivre-api.server");
          const { saveMercadoLivreConnection, consumeMercadoLivreOAuthState } =
            await import("@/lib/mercadolivre-connection.server");
          const userId = await consumeMercadoLivreOAuthState(state);
          // Precisa ser a MESMA redirect_uri (sem query string) usada em
          // /api/mercado-livre/connect — o ML valida que bate exato.
          const redirectUrl = new URL("/api/mercado-livre/callback", request.url).toString();
          const tokens = await exchangeCodeForToken(code, redirectUrl);
          await saveMercadoLivreConnection(tokens, userId);
          console.log("[mercadolivre-callback] loja conectada:", tokens.userId);
          return afterConnectRedirect(request, "mercado-livre", true, "ml=connected");
        } catch (err) {
          console.error("[mercadolivre-callback] falha ao conectar:", err);
          return afterConnectRedirect(request, "mercado-livre", false, "ml=error");
        }
      },
    },
  },
});
