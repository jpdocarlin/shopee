// Notificação push de pedido novo (PWA na tela inicial do iPhone / navegador).
//
// SECURITY: tudo exige sessão (requireSupabaseAuth). Só a conta com a role
// pedidos_admin consegue registrar aparelho; o disparo confere que o pedido é
// de quem chamou, é recente e ainda não foi notificado (uma vez por pedido).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPushPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getVapidKeys } = await import("@/lib/push.server");
    const { publicKey } = await getVapidKeys();
    return { publicKey };
  });

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SubscriptionInput) => {
    const ok =
      typeof data?.endpoint === "string" &&
      data.endpoint.startsWith("https://") &&
      data.endpoint.length < 1000 &&
      typeof data.keys?.p256dh === "string" &&
      typeof data.keys?.auth === "string" &&
      data.keys.p256dh.length < 200 &&
      data.keys.auth.length < 100;
    if (!ok) throw new Error("Inscrição de notificação inválida.");
    return data;
  })
  .handler(async ({ context, data }) => {
    const { userHasRole } = await import("@/lib/push.server");
    if (!(await userHasRole(context.userId, "pedidos_admin"))) {
      throw new Error("Só a conta de pedidos recebe essas notificações.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        user_agent: data.userAgent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Não deu pra salvar este aparelho agora. Tente de novo.");
    return { ok: true };
  });

// Botão "Enviar teste" — confirma na hora que o aparelho recebe.
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userHasRole, sendToPedidosAdmins } = await import("@/lib/push.server");
    if (!(await userHasRole(context.userId, "pedidos_admin"))) {
      throw new Error("Só a conta de pedidos recebe essas notificações.");
    }
    return sendToPedidosAdmins({
      title: "Notificações ativadas ✅",
      body: "É assim que vai chegar cada pedido novo.",
      url: "/pedidos-admin",
      tag: "teste",
    });
  });

// Chamado pelo formulário de Pedidos logo depois de criar o pedido.
export const notifyNewFulfillmentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { requestId: string }) => {
    if (typeof data?.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(data.requestId)) {
      throw new Error("Pedido inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendToPedidosAdmins } = await import("@/lib/push.server");

    // Marca como notificado só se for do usuário, recente e ainda não marcado —
    // numa única operação, pra um clique duplo não mandar duas notificações.
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: claimed, error } = await supabaseAdmin
      .from("fulfillment_requests")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .is("admin_notified_at", null)
      .gte("created_at", since)
      .select("submitter_name, product_name, cost_cents")
      .maybeSingle();
    if (error || !claimed) return { sent: 0 };

    const { formatBRL } = await import("@/lib/format");
    const firstName = claimed.submitter_name.trim().split(/\s+/)[0] || "Revendedor";
    return sendToPedidosAdmins({
      title: `Pedido novo de ${firstName}`,
      // + R$2 da embalagem: é o valor que o revendedor mandou no PIX.
      body: `${claimed.product_name} · PIX de ${formatBRL(claimed.cost_cents + 200)}`,
      url: "/pedidos-admin",
      tag: `pedido-${data.requestId}`,
    });
  });
