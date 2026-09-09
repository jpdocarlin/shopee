// Server functions (RPC) pra tela de Integrações consultar o status da
// conexão com a API oficial da Shopee. Implementação real fica em
// shopee-connection.server.ts, carregada dinamicamente dentro do handler.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShopeeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getShopeeConnection } = await import("@/lib/shopee-connection.server");
    const conn = await getShopeeConnection(context.userId);
    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      shopId: conn.shop_id,
      environment: conn.environment,
    };
  });

// Chamado pela tela de Integrações quando o usuário clica em "Conectar loja
// Shopee". Gera um token de uso único (state) vinculado ao usuário logado e
// devolve pro front, que navega pra /api/shopee/connect?state=<token>. Isso é
// o que permite ao callback (um redirect puro do navegador, sem
// Authorization header) saber em qual conta salvar a conexão.
export const createShopeeConnectState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createShopeeOAuthState } = await import("@/lib/shopee-connection.server");
    const token = await createShopeeOAuthState(context.userId);
    return { token };
  });
