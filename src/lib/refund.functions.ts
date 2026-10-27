// Pedido de reembolso (página /reembolso). Antes o formulário só
// mostrava "enviado" sem salvar nada — agora grava em refund_requests e avisa
// o dono no celular (push), igual pedido novo.
//
// SECURITY: requireSupabaseSession (sem a checagem de acesso em dia) — quem
// está com acesso suspenso ainda precisa conseguir pedir reembolso.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseSession } from "@/integrations/supabase/auth-middleware";

type RefundInput = {
  fullName: string;
  cpf: string;
  email: string;
  purchaseCode: string;
  plan: "mensal" | "vitalicio";
  daysSincePayment: number;
  reason: string;
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const createRefundRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .validator((data: RefundInput) => {
    const out = {
      fullName: clean(data?.fullName, 120),
      cpf: clean(data?.cpf, 20),
      email: clean(data?.email, 160),
      purchaseCode: clean(data?.purchaseCode, 80),
      plan: data?.plan === "vitalicio" ? "vitalicio" : "mensal",
      daysSincePayment: Math.max(
        0,
        Math.min(3650, Math.floor(Number(data?.daysSincePayment) || 0)),
      ),
      reason: clean(data?.reason, 60),
    } as RefundInput;
    if (!out.fullName || !out.cpf || !out.email || !out.purchaseCode || !out.reason) {
      throw new Error("Preencha todos os campos do formulário.");
    }
    return out;
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Um pedido em aberto por vez (evita clique duplo / reenvio).
    const { data: open } = await supabaseAdmin
      .from("refund_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .limit(1);
    if (open && open.length > 0) {
      return { ok: true, alreadyOpen: true };
    }

    const { error } = await supabaseAdmin.from("refund_requests").insert({
      user_id: context.userId,
      full_name: data.fullName,
      cpf: data.cpf,
      email: data.email,
      purchase_code: data.purchaseCode,
      plan: data.plan,
      days_since_payment: data.daysSincePayment,
      reason: data.reason,
    });
    if (error) throw new Error("Não deu pra enviar o pedido agora. Tente de novo em instantes.");

    try {
      const { sendToPedidosAdmins } = await import("@/lib/push.server");
      await sendToPedidosAdmins({
        title: `Reembolso: ${data.fullName.split(/\s+/)[0]}`,
        body: `${data.plan === "vitalicio" ? "Vitalício" : "Mensal"} · pago há ${data.daysSincePayment} dia(s) · código ${data.purchaseCode}`,
        url: "/reembolsos-admin",
        tag: `reembolso-${context.userId}`,
      });
    } catch (err) {
      console.error("[refund] falha ao notificar:", err);
    }
    // Confirmação por e-mail pro cliente. Falha aqui não desfaz o pedido.
    try {
      const { sendEmail, refundRequestedEmail } = await import("@/lib/email.server");
      const mail = refundRequestedEmail({
        firstName: data.fullName.split(/\s+/)[0] || "tudo bem",
        purchaseCode: data.purchaseCode,
        plan: data.plan,
      });
      await sendEmail({ to: data.email, ...mail });
    } catch (err) {
      console.error("[refund] falha ao enviar e-mail:", err);
    }
    return { ok: true, alreadyOpen: false };
  });

// ------------------------------------------------------------------------
// Página /reembolso: dados pra pré-preencher o formulário + os pedidos do
// próprio cliente (com status).
// ------------------------------------------------------------------------

export type MyRefund = {
  id: string;
  status: "pending" | "done" | "denied";
  purchaseCode: string;
  plan: string;
  createdAt: string;
};

export const getMyRefundPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseSession])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: auth }, { data: purchases }, { data: refunds }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, plan, created_at")
          .eq("id", context.userId)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(context.userId),
        supabaseAdmin
          .from("purchases")
          .select("transaction_id, paid_at, plan")
          .eq("user_id", context.userId)
          .order("paid_at", { ascending: false })
          .limit(1),
        supabaseAdmin
          .from("refund_requests")
          .select("id, status, purchase_code, plan, created_at")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
    const purchase = purchases?.[0];
    const paidAt = purchase?.paid_at ?? profile?.created_at ?? null;
    const days = paidAt
      ? Math.max(0, Math.floor((Date.now() - new Date(paidAt).getTime()) / 86_400_000))
      : null;
    return {
      prefill: {
        fullName: profile?.full_name ?? "",
        email: auth?.user?.email ?? "",
        plan: (purchase?.plan ?? profile?.plan) === "vitalicio" ? "vitalicio" : "mensal",
        purchaseCode: purchase?.transaction_id ?? "",
        daysSincePayment: days,
      },
      refunds: (refunds ?? []).map((r): MyRefund => ({
        id: r.id,
        status: (r.status as MyRefund["status"]) ?? "pending",
        purchaseCode: r.purchase_code,
        plan: r.plan,
        createdAt: r.created_at,
      })),
    };
  });

// ------------------------------------------------------------------------
// Admin: lista de reembolsos + marcar como feito/negado (manda e-mail).
// ------------------------------------------------------------------------

async function assertAdmin(userId: string) {
  const { userHasRole } = await import("@/lib/push.server");
  if (!(await userHasRole(userId, "admin")) && !(await userHasRole(userId, "pedidos_admin"))) {
    throw new Error("Sem permissão.");
  }
}

export type AdminRefund = {
  id: string;
  status: "pending" | "done" | "denied";
  fullName: string;
  email: string;
  cpf: string;
  purchaseCode: string;
  plan: string;
  daysSincePayment: number;
  reason: string;
  createdAt: string;
};

export const adminListRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseSession])
  .handler(async ({ context }): Promise<AdminRefund[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Não deu pra carregar os reembolsos.");
    return (data ?? []).map((r) => ({
      id: r.id,
      status: (r.status as AdminRefund["status"]) ?? "pending",
      fullName: r.full_name,
      email: r.email,
      cpf: r.cpf,
      purchaseCode: r.purchase_code,
      plan: r.plan,
      daysSincePayment: r.days_since_payment,
      reason: r.reason,
      createdAt: r.created_at,
    }));
  });

export const adminSetRefundStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseSession])
  .validator((data: { id: string; status: "done" | "denied" | "pending" }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data?.id ?? "")) throw new Error("Pedido inválido.");
    if (!["done", "denied", "pending"].includes(data?.status)) throw new Error("Status inválido.");
    return data;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("refund_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("full_name, email, purchase_code")
      .single();
    if (error || !row) throw new Error("Não deu pra atualizar o pedido.");
    if (data.status === "done") {
      try {
        const { sendEmail, refundDoneEmail } = await import("@/lib/email.server");
        await sendEmail({
          to: row.email,
          ...refundDoneEmail({
            firstName: row.full_name.split(/\s+/)[0] || "tudo bem",
            purchaseCode: row.purchase_code,
          }),
        });
      } catch (err) {
        console.error("[refund] falha ao enviar e-mail de concluído:", err);
      }
    }
    return { ok: true };
  });
