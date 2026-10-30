import type { StoreReport } from "@/lib/store-health.server";
// Server-only: envio de e-mail transacional.
//
// Caminho principal (pedido do Jp, 27/10/2026): sai pelo próprio Gmail do
// suporte, shoppfysuporte@gmail.com, via SMTP do Google com "senha de app"
// (GMAIL_USER + GMAIL_APP_PASSWORD na Vercel). Limite do Gmail: ~500 e-mails
// por dia — sobra pro volume de reembolsos.
// Reserva: Resend (RESEND_API_KEY), se um dia trocar pra domínio próprio.
// Sem nenhuma das duas configuradas, não envia e só registra no log.
const SUPPORT_INBOX = "shoppfysuporte@gmail.com";

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

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

export async function sendViaResendOnly(input: Mail): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };
  return { sent: await sendViaResend(input, key) };
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
      ...(input.headers ? { headers: input.headers } : {}),
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

// E-mail de confirmação do pedido de reembolso (página /reembolso).
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

// E-mail de reembolso concluído (o dono marcou como feito no painel).
export function refundDoneEmail(input: { firstName: string; purchaseCode: string }) {
  const subject = "Seu reembolso foi concluído — Shoppfy";
  const text = [
    `Olá, ${input.firstName}!`,
    "",
    "O seu reembolso foi concluído.",
    "",
    `Código da compra: ${input.purchaseCode}`,
    "",
    "O valor volta no mesmo meio de pagamento que você usou na compra. No cartão, ele aparece na próxima fatura ou na seguinte, conforme o seu banco.",
    "",
    "Se tiver qualquer dúvida, é só responder este e-mail.",
    "",
    "Equipe Shoppfy",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#ff6a00;padding-bottom:16px">Shoppfy</td></tr>
<tr><td style="font-size:16px;line-height:24px">
<p style="margin:0 0 12px">Olá, ${esc(input.firstName)}!</p>
<p style="margin:0 0 16px"><strong>O seu reembolso foi concluído.</strong></p>
<table cellpadding="0" cellspacing="0" style="width:100%;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;margin:0 0 16px">
<tr><td style="padding:12px 14px;font-size:14px;line-height:22px">Código da compra: <strong>${esc(input.purchaseCode)}</strong></td></tr></table>
<p style="margin:0 0 12px">O valor volta no mesmo meio de pagamento que você usou na compra. No cartão, ele aparece na próxima fatura ou na seguinte, conforme o seu banco.</p>
<p style="margin:0 0 20px">Se tiver qualquer dúvida, é só responder este e-mail.</p>
<p style="margin:0;color:#71717a">Equipe Shoppfy</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// Recap semanal da loja (toda segunda de manhã).

export function weeklyRecapEmail(input: {
  firstName: string;
  weekNumber: number;
  report: StoreReport;
}) {
  const r = input.report;
  const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
  const d = (day: string) => day.split("-").reverse().slice(0, 2).join("/");
  const diff = (a: number | null, b: number | null) =>
    a !== null && b !== null && b > 0
      ? ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%)`
      : "";
  const subject = `Semana ${input.weekNumber} da sua loja — ${r.orders} venda(s)`;
  const lines = [
    `Olá, ${input.firstName}! Aqui está a semana ${input.weekNumber} da sua loja (${d(r.from)} a ${d(r.to)}).`,
    "",
    r.visits !== null
      ? `Visitas: ${r.visits}${diff(r.visits, r.prevVisits)}`
      : "Visitas: começamos a contar esta semana.",
    `Vendas: ${r.orders} (semana anterior: ${r.prevOrders}) · ${brl(r.revenueCents)} vendidos · lucro estimado ${brl(r.profitCents)}`,
    r.conversion !== null ? `Conversão: ${(r.conversion * 100).toFixed(1).replace(".", ",")}%` : "",
    "",
    r.topProducts.length
      ? "O que vendeu:"
      : "Nenhuma venda nesta semana — veja abaixo o que fazer.",
    ...r.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} un.`),
    "",
    r.suggestions.length ? "Vale fazer:" : "",
    ...r.suggestions.map((s) => `• ${s.title}: ${s.detail}`),
    "",
    r.attention.length ? "Precisa de atenção:" : "",
    ...r.attention.map((a) => `• ${a}`),
    "",
    "Ver a semana completa: https://www.shoppfy.online/saude-da-loja",
    "",
    "Equipe Shoppfy",
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
  const text = lines.join("\n");

  const card = (label: string, value: string) =>
    `<td style="padding:10px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;text-align:center"><div style="font-size:12px;color:#71717a">${label}</div><div style="font-size:18px;font-weight:bold;margin-top:4px">${value}</div></td>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#ff6a00;padding-bottom:4px">Shoppfy</td></tr>
<tr><td style="font-size:15px;line-height:22px;padding-bottom:16px">Olá, ${esc(input.firstName)}! Aqui está a <strong>semana ${input.weekNumber}</strong> da sua loja (${d(r.from)} a ${d(r.to)}).</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="6"><tr>
${card("Visitas", r.visits !== null ? `${r.visits}${diff(r.visits, r.prevVisits)}` : "—")}
${card("Vendas", `${r.orders}`)}
${card("Lucro estimado", brl(r.profitCents))}
</tr></table></td></tr>
${r.visits === null ? `<tr><td style="font-size:12px;color:#71717a;padding:6px 0 0">As visitas começam a ser contadas a partir desta semana.</td></tr>` : ""}
<tr><td style="font-size:15px;font-weight:bold;padding:18px 0 6px">${r.topProducts.length ? "O que vendeu" : "Nenhuma venda nesta semana"}</td></tr>
${r.topProducts.map((p, i) => `<tr><td style="font-size:14px;padding:3px 0">${i + 1}. ${esc(p.name)} — <strong>${p.qty} un.</strong></td></tr>`).join("")}
${r.suggestions.length ? `<tr><td style="font-size:15px;font-weight:bold;padding:18px 0 6px">Vale fazer esta semana</td></tr>` : ""}
${r.suggestions.map((s) => `<tr><td style="font-size:14px;line-height:20px;padding:6px 10px;background:#fff7ed;border-radius:8px"><strong>${esc(s.title)}</strong><br>${esc(s.detail)}</td></tr><tr><td style="height:6px"></td></tr>`).join("")}
${r.attention.length ? `<tr><td style="font-size:15px;font-weight:bold;padding:14px 0 6px">Precisa de atenção</td></tr>` : ""}
${r.attention.map((a) => `<tr><td style="font-size:14px;padding:3px 0">• ${esc(a)}</td></tr>`).join("")}
<tr><td style="padding:22px 0 8px"><a href="https://www.shoppfy.online/saude-da-loja" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:8px">Ver a semana completa</a></td></tr>
<tr><td style="font-size:13px;color:#71717a">Equipe Shoppfy</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// Convite da Comunidade Shoppfy no Telegram (campanha de e-mail, 29/10/2026).
export const COMMUNITY_LINK = "https://t.me/+vfJk0yfvNvMyNjlh";

export function communityInviteEmail(input: { firstName: string | null; unsubscribeUrl: string }) {
  const hi = input.firstName ? `Oi, ${input.firstName}! Tudo bem?` : "Oi! Tudo bem?";
  const subject = "Tem um grupo esperando por você 🚀";
  const items = [
    ["Ficar por dentro das novidades", "do sistema antes de todo mundo"],
    ["Trocar experiência", "com outros lojistas: o que está vendendo, preço, anúncio"],
    ["Tirar dúvidas", "direto com a nossa equipe"],
    ["Saber dos produtos novos e em alta", "do catálogo"],
  ];
  const text = [
    hi,
    "",
    "Criamos a Comunidade Shoppfy no Telegram: um espaço só pra quem usa a Shoppfy e quer vender mais na Shopee e no Mercado Livre.",
    "",
    "Lá dentro você vai:",
    ...items.map(([b, r]) => `- ${b} ${r}`),
    "",
    "É de graça e já está liberado pra você:",
    `Entrar na comunidade: ${COMMUNITY_LINK}`,
    "",
    "Te esperamos lá!",
    "",
    "—",
    `Você recebeu este e-mail porque usa a Shoppfy. Não quer mais receber avisos como este? Sair da lista: ${input.unsubscribeUrl}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#ff6a00;padding-bottom:16px">Shoppfy</td></tr>
<tr><td style="font-size:16px;line-height:24px">
<p style="margin:0 0 12px">${esc(hi)}</p>
<p style="margin:0 0 16px">Criamos a <strong>Comunidade Shoppfy no Telegram</strong>: um espaço só pra quem usa a Shoppfy e quer vender mais na Shopee e no Mercado Livre.</p>
<p style="margin:0 0 8px">Lá dentro você vai:</p>
<ul style="margin:0 0 16px;padding-left:20px">
${items.map(([b, r]) => `<li style="margin:0 0 6px"><strong>${esc(b)}</strong> ${esc(r)}</li>`).join("\n")}
</ul>
<p style="margin:0 0 20px">É de graça e já está liberado pra você:</p>
<p style="margin:0 0 24px"><a href="${COMMUNITY_LINK}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Entrar na comunidade</a></p>
<p style="margin:0 0 4px">Te esperamos lá!</p>
</td></tr>
<tr><td style="padding-top:24px;border-top:1px solid #e4e4e7;font-size:12px;line-height:18px;color:#a1a1aa">
Você recebeu este e-mail porque usa a Shoppfy. Não quer mais receber avisos como este? <a href="${esc(input.unsubscribeUrl)}" style="color:#a1a1aa">Sair da lista</a>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}
