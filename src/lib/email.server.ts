// Server-only: envio de e-mail transacional pelo Resend (https://resend.com),
// via API HTTP — sem dependência nova. Precisa de RESEND_API_KEY na Vercel e
// do domínio do remetente verificado no Resend. Sem a chave, não envia e só
// registra no log (nada quebra pra quem chamou).
const FROM = process.env.EMAIL_FROM || "Shoppfy <contato@shoppfy.online>";

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY não configurada — e-mail não enviado:", input.subject);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend recusou:", res.status, (await res.text()).slice(0, 300));
    return { sent: false };
  }
  return { sent: true };
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

// E-mail de confirmação do pedido de reembolso (Configurações → Reembolso).
export function refundRequestedEmail(input: {
  firstName: string;
  purchaseCode: string;
  plan: "mensal" | "vitalicio";
}) {
  const plan = input.plan === "vitalicio" ? "Vitalício" : "Mensal";
  const subject = "Seu pedido de reembolso foi recebido — Shoppfy";
  const text = [
    `Olá, ${input.firstName}!`,
    "",
    "Recebemos o seu pedido de reembolso e ele já foi solicitado.",
    "",
    `Código da compra: ${input.purchaseCode}`,
    `Plano: ${plan}`,
    "",
    "O valor é devolvido no mesmo meio de pagamento que você usou na compra. Você não precisa fazer mais nada agora.",
    "",
    "Se tiver qualquer dúvida, responda este e-mail ou fale com o atendimento em shoppfy.online/atendimento.",
    "",
    "Equipe Shoppfy",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#ff6a00;padding-bottom:16px">Shoppfy</td></tr>
<tr><td style="font-size:16px;line-height:24px">
<p style="margin:0 0 12px">Olá, ${esc(input.firstName)}!</p>
<p style="margin:0 0 16px"><strong>Recebemos o seu pedido de reembolso e ele já foi solicitado.</strong></p>
<table cellpadding="0" cellspacing="0" style="width:100%;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;margin:0 0 16px">
<tr><td style="padding:12px 14px;font-size:14px;line-height:22px">
Código da compra: <strong>${esc(input.purchaseCode)}</strong><br>Plano: <strong>${plan}</strong>
</td></tr></table>
<p style="margin:0 0 12px">O valor é devolvido no mesmo meio de pagamento que você usou na compra. Você não precisa fazer mais nada agora.</p>
<p style="margin:0 0 20px">Se tiver qualquer dúvida, é só responder este e-mail ou falar com o <a href="https://www.shoppfy.online/atendimento" style="color:#ff6a00">atendimento</a>.</p>
<p style="margin:0;color:#71717a">Equipe Shoppfy</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}
