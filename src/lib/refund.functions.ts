// Pedido de reembolso (Configurações → Reembolso). Antes o formulário só
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
        url: "/atendimento-admin",
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
