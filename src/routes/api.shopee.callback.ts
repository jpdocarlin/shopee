import { createFileRoute } from "@tanstack/react-router";

// Callback do OAuth da Shopee — recebe ?code&shop_id, troca por
// access_token/refresh_token e salva na conta do dono (marketplace_accounts).
// Depois manda de volta pra Integrações com um aviso de sucesso/erro.
export const Route = createFileRoute("/api/shopee/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const shopIdRaw = url.searchParams.get("shop_id");

        if (!code || !shopIdRaw) {
          return Response.redirect(
            new URL("/integracoes?shopee=error&reason=missing_params", url.origin).toString(),
            302,
          );
        }

        try {
          const { exchangeCodeForToken } = await import("@/lib/shopee-api.server");
          const { saveShopeeConnection } = await import("@/lib/shopee-connection.server");

          const tokens = await exchangeCodeForToken(code, Number(shopIdRaw));
          await saveShopeeConnection(tokens);

          console.log("[shopee-callback] loja conectada:", tokens.shopId);
          return Response.redirect(new URL("/integracoes?shopee=connected", url.origin).toString(), 302);
        } catch (err) {
          console.error("[shopee-callback] falha ao conectar:", err);
          return Response.redirect(
            new URL("/integracoes?shopee=error", url.origin).toString(),
            302,
          );
        }
      },
    },
  },
});
