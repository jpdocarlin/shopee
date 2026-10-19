// Painel de atendimento (dono): dados de contato de quem está falando com o
// bot — nome, e-mail, telefone e plano — sempre visíveis na conversa.
// SECURITY: só a role admin. Lê com service role porque a RLS de profiles
// só deixa cada um ler o próprio perfil.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportCustomer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
};

export const getSupportCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userIds: string[] }) => {
    const ids = Array.isArray(data?.userIds) ? data.userIds : [];
    return { userIds: ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 300) };
  })
  .handler(async ({ context, data }) => {
    const { userHasRole } = await import("@/lib/push.server");
    if (!(await userHasRole(context.userId, "admin"))) throw new Error("Sem permissão.");
    if (data.userIds.length === 0) return {} as Record<string, SupportCustomer>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: orders }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone, plan")
        .in("id", data.userIds),
      supabaseAdmin
        .from("fulfillment_requests")
        .select("user_id, submitter_name, submitter_phone, submitter_email")
        .in("user_id", data.userIds)
        .order("created_at", { ascending: false }),
    ]);

    const out: Record<string, SupportCustomer> = {};
    for (const id of data.userIds) {
      const p = profiles?.find((r) => r.id === id);
      const o = orders?.find((r) => r.user_id === id);
      out[id] = {
        name: p?.full_name || o?.submitter_name || null,
        email: p?.email || o?.submitter_email || null,
        phone: p?.phone || o?.submitter_phone || null,
        plan: p?.plan ?? null,
      };
    }
    return out;
  });
