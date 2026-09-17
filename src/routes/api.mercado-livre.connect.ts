import { createFileRoute } from "@tanstack/react-router";

// Ponto de entrada: a tela de Integrações chama createMercadoLivreConnectState()
// (autenticado, via requireSupabaseAuth) pra pegar um token de uso único, e
// navega pra cá com ?state=<token>. Espelha api.shopee.connect.ts. Diferente
// da Shopee, o `state` aqui NÃO vai embutido na URL de retorno — vai como o
// parâmetro OAuth padrão `state=` na própria URL de autorização (ver
// buildAuthLink em mercadolivre-api.server.ts), porque o Mercado Livre
// exige que a Redirect URI cadastrada no app bata EXATA, sem query string
// extra. O ML devolve esse mesmo `state` de volta no callback ao lado do
// `code`, então /api/mercado-livre/callback ainda sabe pra qual usuário
// salvar a conexão.
export const Route = createFileRoute("/api/mercado-livre/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const state = url.searchParams.get("state");
          if (!state) {
            return Response.redirect(
              new URL("/integracoes?ml=error&reason=missing_state", url.origin).toString(),
              302,
            );
          }
          const { buildAuthLink } = await import("@/lib/mercadolivre-api.server");
          // Redirect URI FIXA (sem query string) — precisa ser exatamente
          // essa mesma URL cadastrada como "Redirect URI" no app do Mercado
          // Livre Developers.
          const redirectUrl = new URL("/api/mercado-livre/callback", request.url).toString();
          const authLink = buildAuthLink(redirectUrl, state);
          return Response.redirect(authLink, 302);
        } catch (err) {
          console.error("[mercadolivre-connect] erro:", err);
          return new Response(
            `Não foi possível iniciar a conexão com o Mercado Livre: ${err instanceof Error ? err.message : String(err)}`,
            { status: 500 },
          );
        }
      },
    },
  },
});
