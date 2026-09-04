import { createFileRoute } from "@tanstack/react-router";

// Ponto de entrada: o Jp clica em "Conectar loja Shopee" em Integrações, o
// navegador bate aqui e a gente já redireciona (302) pro link de autorização
// assinado da Shopee. Depois de logar com a conta da loja, a Shopee manda o
// navegador de volta pra /api/shopee/callback com ?code&shop_id.
export const Route = createFileRoute("/api/shopee/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { buildAuthLink } = await import("@/lib/shopee-api.server");
          const redirectUrl = new URL("/api/shopee/callback", request.url).toString();
          const authLink = buildAuthLink(redirectUrl);
          return Response.redirect(authLink, 302);
        } catch (err) {
          console.error("[shopee-connect] erro ao montar link de autorização:", err);
          return new Response(
            `Não foi possível iniciar a conexão com a Shopee: ${err instanceof Error ? err.message : String(err)}`,
            { status: 500 },
          );
        }
      },
    },
  },
});
