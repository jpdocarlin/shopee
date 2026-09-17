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
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return Response.redirect(
            new URL("/integracoes?ml=error&reason=missing_params", url.origin).toString(),
            302,
          );
        }
        try {
          const { exchangeCodeForToken } = await import("@/lib/mercadolivre-api.server");
          const { saveMercadoLivreConnection, consumeMercadoLivreOAuthState } = await import(
            "@/lib/mercadolivre-connection.server"
          );
          const userId = await consumeMercadoLivreOAuthState(state);
          // Precisa ser a MESMA redirect_uri (sem query string) usada em
          // /api/mercado-livre/connect — o ML valida que bate exato.
          const redirectUrl = new URL("/api/mercado-livre/callback", request.url).toString();
          const tokens = await exchangeCodeForToken(code, redirectUrl);
          await saveMercadoLivreConnection(tokens, userId);
          console.log("[mercadolivre-callback] loja conectada:", tokens.userId);
          return Response.redirect(new URL("/integracoes?ml=connected", url.origin).toString(), 302);
        } catch (err) {
          console.error("[mercadolivre-callback] falha ao conectar:", err);
          return Response.redirect(new URL("/integracoes?ml=error", url.origin).toString(), 302);
        }
      },
    },
  },
});
