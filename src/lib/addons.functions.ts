// RPCs dos extras: Lista dos Produtos Campeões e Calls de implementação.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type { Champion } from "@/lib/campeoes.server";

async function isStaff(userId: string) {
  const { userHasRole } = await import("@/lib/push.server");
  return (await userHasRole(userId, "admin")) || (await userHasRole(userId, "pedidos_admin"));
}

export const getChampions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasEntitlement } = await import("@/lib/addons.server");
    const allowed =
      (await hasEntitlement(context.userId, "campeoes")) || (await isStaff(context.userId));
    if (!allowed) return { locked: true as const, items: [] };
    const { buildChampions } = await import("@/lib/campeoes.server");
    return { locked: false as const, items: await buildChampions(50) };
  });

export type CallBooking = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  paidAt: string;
  slotAt: string;
  status: "scheduled" | "done" | "no_show" | "canceled";
};

async function assertPedidosAdmin(userId: string) {
  const { userHasRole } = await import("@/lib/push.server");
  if (!(await userHasRole(userId, "pedidos_admin"))) throw new Error("Sem permissão.");
}

export const adminListCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCallRoomUrl } = await import("@/lib/addons.server");
    const { data } = await supabaseAdmin
      .from("call_bookings" as never)
      .select("id, name, email, phone, paid_at, slot_at, status")
      .gte("slot_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("slot_at", { ascending: true })
      .limit(500);
    const rows = (data ?? []) as Array<{
      id: string;
      name: string | null;
      email: string;
      phone: string | null;
      paid_at: string;
      slot_at: string;
      status: CallBooking["status"];
    }>;
    return {
      roomUrl: await getCallRoomUrl(),
      calls: rows.map((r): CallBooking => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        paidAt: r.paid_at,
        slotAt: r.slot_at,
        status: r.status,
      })),
    };
  });

export const adminSetCallStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; status: CallBooking["status"] }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data?.id ?? "")) throw new Error("Call inválida.");
    if (!["scheduled", "done", "no_show", "canceled"].includes(data?.status))
      throw new Error("Status inválido.");
    return data;
  })
  .handler(async ({ context, data }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("call_bookings" as never)
      .update({ status: data.status } as never)
      .eq("id", data.id);
    return { ok: true };
  });

export const adminSetCallRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { url: string }) => {
    const url = (data?.url ?? "").trim();
    if (!/^https:\/\/\S+$/.test(url)) throw new Error("Cole um link https válido.");
    return { url };
  })
  .handler(async ({ context, data }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("app_settings" as never)
      .upsert(
        { key: "call_room_url", value: data.url, updated_at: new Date().toISOString() } as never,
        {
          onConflict: "key",
        },
      );
    return { ok: true };
  });

// ---------------------------------------------------------------- Acelerador
export type AceleradorMember = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  joinedAt: string;
  expiresAt: string;
  daysLeft: number;
  linkSent: boolean;
  removed: boolean;
  status: "active" | "refunded";
};
export type AceleradorGroup = {
  id: string;
  number: number;
  whatsappUrl: string | null;
  members: AceleradorMember[];
};

export const adminListAcelerador = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: groups }, { data: members }] = await Promise.all([
      supabaseAdmin
        .from("acelerador_groups" as never)
        .select("id, number, whatsapp_url")
        .order("number", { ascending: false }),
      supabaseAdmin
        .from("acelerador_members" as never)
        .select(
          "id, group_id, name, email, phone, joined_at, expires_at, link_sent_at, removed_at, status",
        )
        .order("joined_at", { ascending: true }),
    ]);
    const now = Date.now();
    const byGroup = new Map<string, AceleradorMember[]>();
    for (const m of (members ?? []) as Array<{
      id: string;
      group_id: string;
      name: string | null;
      email: string;
      phone: string | null;
      joined_at: string;
      expires_at: string;
      link_sent_at: string | null;
      removed_at: string | null;
      status: "active" | "refunded";
    }>) {
      const list = byGroup.get(m.group_id) ?? [];
      list.push({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        joinedAt: m.joined_at,
        expiresAt: m.expires_at,
        daysLeft: Math.ceil((new Date(m.expires_at).getTime() - now) / 86400000),
        linkSent: !!m.link_sent_at,
        removed: !!m.removed_at,
        status: m.status,
      });
      byGroup.set(m.group_id, list);
    }
    return (
      (groups ?? []) as Array<{ id: string; number: number; whatsapp_url: string | null }>
    ).map((g): AceleradorGroup => ({
      id: g.id,
      number: g.number,
      whatsappUrl: g.whatsapp_url,
      members: byGroup.get(g.id) ?? [],
    }));
  });

// Salva o link do grupo da turma e manda por e-mail pra quem ainda não recebeu.
export const adminSetAceleradorGroupLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { groupId: string; url: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data?.groupId ?? "")) throw new Error("Turma inválida.");
    const url = (data?.url ?? "").trim();
    if (!/^https:\/\/(chat\.whatsapp\.com|wa\.me)\/\S+$/.test(url))
      throw new Error("Cole o link de convite do grupo (https://chat.whatsapp.com/…).");
    return { groupId: data.groupId, url };
  })
  .handler(async ({ context, data }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("acelerador_groups" as never)
      .update({ whatsapp_url: data.url } as never)
      .eq("id", data.groupId);
    const { data: pending } = await supabaseAdmin
      .from("acelerador_members" as never)
      .select("id, name, email")
      .eq("group_id", data.groupId)
      .eq("status", "active")
      .is("link_sent_at", null);
    const { aceleradorWelcomeEmail, sendEmail } = await import("@/lib/email.server");
    let sent = 0;
    for (const m of (pending ?? []) as Array<{ id: string; name: string | null; email: string }>) {
      const mail = aceleradorWelcomeEmail({
        firstName: m.name?.trim().split(/\s+/)[0] ?? null,
        groupUrl: data.url,
      });
      try {
        await sendEmail({ to: m.email, ...mail });
        await supabaseAdmin
          .from("acelerador_members" as never)
          .update({ link_sent_at: new Date().toISOString() } as never)
          .eq("id", m.id);
        sent++;
      } catch (err) {
        console.error("[acelerador] e-mail do link falhou:", err);
      }
    }
    return { ok: true, sent };
  });

// Marca (ou desmarca) que a pessoa já foi tirada do grupo do WhatsApp.
export const adminSetAceleradorRemoved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; removed: boolean }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data?.id ?? "")) throw new Error("Aluno inválido.");
    return { id: data.id, removed: !!data.removed };
  })
  .handler(async ({ context, data }) => {
    await assertPedidosAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("acelerador_members" as never)
      .update({ removed_at: data.removed ? new Date().toISOString() : null } as never)
      .eq("id", data.id);
    return { ok: true };
  });
