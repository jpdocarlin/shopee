// Server functions (RPC) pra tela de Integrações consultar o status da
// conexão com a API oficial da Shopee. Implementação real fica em
// shopee-connection.server.ts, carregada dinamicamente dentro do handler.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShopeeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getShopeeConnection } = await import("@/lib/shopee-connection.server");
    const conn = await getShopeeConnection();
    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      shopId: conn.shop_id,
      environment: conn.environment,
    };
  });
