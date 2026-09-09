import { createFileRoute } from "@tanstack/react-router";

// Ponto de entrada: a tela de Integrações chama createShopeeOAuthState()
// (autenticado, via requireSupabaseAuth) pra pegar um token de uso único, e
// navega pra cá com ?state=<token>. A gente embute esse state na URL de
// retorno que manda pra Shopee, assim o /api/shopee/callback (que é um
// redirect puro do navegador, sem Authorization header) sabe pra qual
// usuário salvar a conexão.
export const Route = createFileRoute("/api/shopee/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const state = url.searchParams.get("state");
          if (!state) {
            return Response.redirect(
              new URL("/integracoes?shopee=error&reason=missing_state", url.origin).toString(),
              302,
            );
          }
          const { buildAuthLink } = await import("@/lib/shopee-api.server");
          const redirectUrl = new URL("/api/shopee/callback", request.url);
          redirectUrl.searchParams.set("state", state);
          const authLink = buildAuthLink(redirectUrl.toString());
          return Response.redirect(authLink, 302);
        } catch (err) {
          console.error("[shopee-connect] erro:", err);
          return new Response(
            `Não foi possível iniciar a conexão com a Shopee: ${err instanceof Error ? err.message : String(err)}`,
            { status: 500 },
          );
        }
      },
    },
  },
});
