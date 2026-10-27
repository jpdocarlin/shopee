// Server-only: envio de e-mail transacional.
//
// Caminho principal (pedido do Jp, 27/10/2026): sai pelo próprio Gmail do
// suporte, shoppfysuporte@gmail.com, via SMTP do Google com "senha de app"
// (GMAIL_USER + GMAIL_APP_PASSWORD na Vercel). Limite do Gmail: ~500 e-mails
// por dia — sobra pro volume de reembolsos.
// Reserva: Resend (RESEND_API_KEY), se um dia trocar pra domínio próprio.
// Sem nenhuma das duas configuradas, não envia e só registra no log.
const SUPPORT_INBOX = "shoppfysuporte@gmail.com";

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

async function sendViaGmail(input: Mail, user: string, pass: string): Promise<boolean> {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });
  try {
    await transport.sendMail({
      from: `"Shoppfy Suporte" <${user}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    return true;
  } catch (err) {
    console.error("[email] Gmail recusou:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendViaResend(input: Mail, key: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Shoppfy Suporte <contato@shoppfy.online>",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      // Respostas do cliente caem no Gmail do suporte.
      reply_to: input.replyTo ?? SUPPORT_INBOX,
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend recusou:", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

export async function sendEmail(input: Mail): Promise<{ sent: boolean }> {
  const gmailUser = process.env.GMAIL_USER || "shoppfysuporte@gmail.com";
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailPass) return { sent: await sendViaGmail(input, gmailUser, gmailPass) };
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return { sent: await sendViaResend(input, resendKey) };
  console.warn(
    "[email] nenhum envio configurado (GMAIL_APP_PASSWORD) — não enviado:",
    input.subject,
  );
  return { sent: false };
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
