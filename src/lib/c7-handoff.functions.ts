// "Comprar na C7": gera um passe curto (30 min) que a extensão da Shoppfy no
// Chrome usa pra buscar os dados do pedido e preencher a compra na C7Drop.
//
// SECURITY: só a conta de pedidos (role pedidos_admin) gera o passe. O passe
// é aleatório (32 bytes), expira em 30 min e só serve pra ler UM pedido.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createC7Handoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { requestId: string }) => {
    const requestId = typeof data?.requestId === "string" ? data.requestId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Pedido inválido.");
    return { requestId };
  })
  .handler(async ({ context, data }) => {
    const { userHasRole } = await import("@/lib/push.server");
    if (!(await userHasRole(context.userId, "pedidos_admin"))) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("fulfillment_requests")
      .select("id, product_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req?.product_id) throw new Error("Esse pedido não tem um produto do catálogo.");
    const { C7DROP_PRODUCTS } = await import("@/data/c7drop-products");
    const product = C7DROP_PRODUCTS.find((p) => p.id === req.product_id);
    if (!product) throw new Error("Produto não encontrado no catálogo da C7.");

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin.from("c7_handoffs" as never).insert({
      token,
      request_id: req.id,
      created_by: context.userId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    } as never);
    if (error) throw new Error("Não deu pra preparar a compra agora.");
    return {
      url: `https://www.c7drop.com.br/produto/${product.slug}#shoppfy-c7=${token}`,
    };
  });
