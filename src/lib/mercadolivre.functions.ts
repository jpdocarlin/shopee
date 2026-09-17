// Server functions (RPC) pra tela de Integrações consultar o status da
// conexão com a API oficial do Mercado Livre. Espelha shopee.functions.ts.
// Implementação real fica em mercadolivre-connection.server.ts, carregada
// dinamicamente dentro do handler.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMercadoLivreStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMercadoLivreConnection } = await import("@/lib/mercadolivre-connection.server");
    const conn = await getMercadoLivreConnection(context.userId);
    if (!conn) return { connected: false as const };
    return { connected: true as const, sellerId: conn.user_id };
  });

// Chamado pela tela de Integrações quando o usuário clica em "Conectar loja
// Mercado Livre". Gera um token de uso único (state) vinculado ao usuário
// logado e devolve pro front, que navega pra
// /api/mercado-livre/connect?state=<token>.
export const createMercadoLivreConnectState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createMercadoLivreOAuthState } = await import("@/lib/mercadolivre-connection.server");
    const token = await createMercadoLivreOAuthState(context.userId);
    return { token };
  });
