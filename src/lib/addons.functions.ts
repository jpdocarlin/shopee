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
