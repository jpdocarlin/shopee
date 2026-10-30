// Server-only: extras vendidos na Applyfy além do plano —
//   • order bump "Lista dos Produtos Campeões" (kind "campeoes")
//   • upsell "Call de implementação" (kind "call")
// O webhook da Applyfy chama recordApplyfyEvent + grantAddonsFromPayload.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AddonKind = "campeoes" | "call";

const CALL_FIRST_HOUR = 9; // primeira sala (horário de Brasília)
const CALL_LAST_HOUR = 21; // última sala
const CALL_MIN_WAIT_MIN = 30;

// Todos os textos do payload (ids, nomes), pra procurar os produtos mapeados.
function collectStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 8 || value === null || value === undefined) return out;
  if (typeof value === "string" || typeof value === "number") out.push(String(value));
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out, depth + 1));
  else if (typeof value === "object")
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "token") continue;
      collectStrings(v, out, depth + 1);
    }
  return out;
}

export async function recordApplyfyEvent(payload: Record<string, unknown>) {
  const { token: _t, ...safe } = payload;
  const client = (payload.client ?? {}) as { email?: string };
  const tx = (payload.transaction ?? {}) as { id?: string };
  await supabaseAdmin
    .from("applyfy_events" as never)
    .insert({
      event: typeof payload.event === "string" ? payload.event : null,
      email: client.email?.toLowerCase() ?? null,
      transaction_id: tx.id ?? null,
      payload: safe,
    } as never)
    .then(
      () => undefined,
      (err: unknown) => console.error("[applyfy-events] falha ao gravar:", err),
    );
}

// Produto principal (o plano da Shoppfy) na Applyfy.
const MAIN_PRODUCT_ID = "cmrujoz4e08o001or9afpmypi";

export function payloadHasMainProduct(payload: Record<string, unknown>): boolean {
  const texts = collectStrings(payload).map((s) => s.trim().toLowerCase());
  return texts.some((t) => t === MAIN_PRODUCT_ID || t === "shoppfy");
}

export async function detectAddons(payload: Record<string, unknown>): Promise<AddonKind[]> {
  const { data } = await supabaseAdmin.from("applyfy_product_map" as never).select("match, kind");
  const map = (data ?? []) as Array<{ match: string; kind: AddonKind }>;
  if (!map.length) return [];
  const texts = collectStrings(payload).map((s) => s.toLowerCase());
  const found = new Set<AddonKind>();
  for (const m of map) {
    const needle = m.match.toLowerCase();
    if (texts.some((t) => t === needle || (needle.length >= 6 && t.includes(needle))))
      found.add(m.kind);
  }
  return [...found];
}

// Próxima sala: hora cheia, pelo menos 30 min depois do pagamento, entre 9h e 21h.
export function nextCallSlot(paidAt: Date): Date {
  const brt = (d: Date) => new Date(d.getTime() - 3 * 3600 * 1000);
  const fromBrt = (y: number, m: number, d: number, h: number) =>
    new Date(Date.UTC(y, m, d, h + 3, 0, 0));
  const earliest = new Date(paidAt.getTime() + CALL_MIN_WAIT_MIN * 60 * 1000);
  const b = brt(earliest);
  let hour = b.getUTCHours() + (b.getUTCMinutes() > 0 || b.getUTCSeconds() > 0 ? 1 : 0);
  let y = b.getUTCFullYear();
  let m = b.getUTCMonth();
  let d = b.getUTCDate();
  if (hour < CALL_FIRST_HOUR) hour = CALL_FIRST_HOUR;
  if (hour > CALL_LAST_HOUR) {
    const next = new Date(Date.UTC(y, m, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth();
    d = next.getUTCDate();
    hour = CALL_FIRST_HOUR;
  }
  return fromBrt(y, m, d, hour);
}

export async function getCallRoomUrl(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings" as never)
    .select("value")
    .eq("key", "call_room_url")
    .maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

export function formatSlot(slot: Date): string {
  return slot.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function grantAddons(params: {
  userId: string;
  kinds: AddonKind[];
  transactionId: string | null;
  email: string;
  name: string | null;
  paidAt: Date;
}) {
  for (const kind of params.kinds) {
    await supabaseAdmin.from("user_entitlements" as never).upsert(
      {
        user_id: params.userId,
        kind,
        transaction_id: params.transactionId,
        granted_at: new Date().toISOString(),
        revoked_at: null,
      } as never,
      { onConflict: "user_id,kind" },
    );
  }

  if (params.kinds.includes("call")) {
    const slot = nextCallSlot(params.paidAt);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", params.userId)
      .maybeSingle();
    const name = params.name || profile?.full_name || null;
    const { data: existing } = await supabaseAdmin
      .from("call_bookings" as never)
      .select("id")
      .eq("transaction_id", params.transactionId ?? "")
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("call_bookings" as never).insert({
        user_id: params.userId,
        transaction_id: params.transactionId,
        name,
        email: params.email,
        phone: profile?.phone ?? null,
        paid_at: params.paidAt.toISOString(),
        slot_at: slot.toISOString(),
      } as never);

      const room = await getCallRoomUrl();
      const when = formatSlot(slot);
      const { callBookedEmail, sendEmail } = await import("@/lib/email.server");
      const mail = callBookedEmail({
        firstName: name?.trim().split(/\s+/)[0] ?? null,
        when,
        roomUrl: room,
      });
      await sendEmail({ to: params.email, ...mail }).catch((err) =>
        console.error("[addons] e-mail da call falhou:", err),
      );
      const { sendToPedidosAdmins } = await import("@/lib/push.server");
      await sendToPedidosAdmins({
        title: "Nova call de implementação",
        body: `${name ?? params.email} — sala de ${when}`,
        url: "/calls-admin",
        tag: `call-${params.transactionId ?? params.userId}`,
      }).catch(() => undefined);
    }
  }
}

// Reembolso de uma compra que era SÓ o extra (ex.: a call como upsell):
// tira só o extra, sem bloquear o acesso ao sistema.
export async function revokeAddonOnlyTransaction(transactionId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_entitlements" as never)
    .select("user_id, kind")
    .eq("transaction_id", transactionId);
  const rows = (data ?? []) as Array<{ user_id: string; kind: AddonKind }>;
  if (!rows.length) return false;
  // Só é "compra só do extra" se essa transação não é a do plano.
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  for (const r of rows) {
    await supabaseAdmin
      .from("user_entitlements" as never)
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("user_id", r.user_id)
      .eq("kind", r.kind);
  }
  await supabaseAdmin
    .from("call_bookings" as never)
    .update({ status: "canceled" } as never)
    .eq("transaction_id", transactionId);
  return !purchase;
}

export async function hasEntitlement(userId: string, kind: AddonKind): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_entitlements" as never)
    .select("revoked_at")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  const row = data as { revoked_at: string | null } | null;
  return !!row && !row.revoked_at;
}
