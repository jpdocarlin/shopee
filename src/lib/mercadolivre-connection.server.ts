// Server-only: guarda/lê a conexão da loja Mercado Livre (tokens da API
// oficial) por usuário — cada conta do Shoppfy pode conectar a própria loja
// e publicar nela (marketplace_accounts é escopado por user_id). Espelha
// shopee-connection.server.ts, que serviu de modelo pra esse arquivo. O
// `userId` usado aqui sempre vem do lado do servidor (context.userId de
// requireSupabaseAuth, ou do state de OAuth de uso único no callback) —
// nunca de um valor enviado pelo cliente.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { MercadoLivreTokenSet } from "@/lib/mercadolivre-api.server";

let _admin: ReturnType<typeof createClient<Database>> | undefined;

function getAdminClient() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.");
  }
  _admin = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

async function getMercadoLivreMarketplaceId(): Promise<string> {
  const admin = getAdminClient();
  // A linha "mercado-livre" já existe na tabela marketplaces desde a
  // migration inicial do schema (20260730153856) — foi cadastrada junto com
  // "shopee" antes mesmo dessa integração existir, então não precisa de
  // migration nova pra isso.
  const { data, error } = await admin
    .from("marketplaces")
    .select("id")
    .eq("slug", "mercado-livre")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Marketplace "mercado-livre" não encontrado na tabela marketplaces.');
  return data.id;
}

export type MercadoLivreConnectionMetadata = {
  mercadolivre_api?: {
    user_id: number; // user_id do vendedor NO Mercado Livre (não confundir com o user_id do Supabase)
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
};

// Mesma cautela documentada em shopee-connection.server.ts: usa `.limit(1)`
// + `order(updated_at desc)` em vez de `.maybeSingle()` pra achar a conta
// existente — evita quebrar (ou duplicar linha) se algum dia sobrar mais de
// uma linha marketplace_accounts pra esse (user_id, marketplace_id).
async function findExistingAccountRow(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  marketplaceId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .from("marketplace_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function saveMercadoLivreConnection(
  tokens: MercadoLivreTokenSet,
  userId: string,
): Promise<void> {
  const admin = getAdminClient();
  const marketplaceId = await getMercadoLivreMarketplaceId();

  const metadata: MercadoLivreConnectionMetadata = {
    mercadolivre_api: {
      user_id: tokens.userId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
    },
  };

  const existing = await findExistingAccountRow(admin, userId, marketplaceId);

  if (existing) {
    const { error } = await admin
      .from("marketplace_accounts")
      .update({
        status: "active",
        label: "Loja Mercado Livre (API oficial)",
        metadata: metadata as unknown as never,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("marketplace_accounts").insert({
      user_id: userId,
      marketplace_id: marketplaceId,
      label: "Loja Mercado Livre (API oficial)",
      status: "active",
      metadata: metadata as unknown as never,
    });
    if (error) throw error;
  }
}

export async function getMercadoLivreConnection(
  userId: string,
): Promise<MercadoLivreConnectionMetadata["mercadolivre_api"] | null> {
  const admin = getAdminClient();
  const marketplaceId = await getMercadoLivreMarketplaceId();

  const { data, error } = await admin
    .from("marketplace_accounts")
    .select("metadata")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const metadata = data?.[0]?.metadata as MercadoLivreConnectionMetadata | undefined;
  return metadata?.mercadolivre_api ?? null;
}

// 17/09/2026: mesmo problema já visto ao vivo na Shopee (ver
// invalidateShopeeConnection em shopee-connection.server.ts) — se a loja
// desautorizar o app pelo lado do Mercado Livre, ou o refresh_token (que lá
// é de uso único e expira depois de 6 meses sem uso) ficar inválido por
// qualquer motivo, o refresh nunca mais funciona e a pessoa fica presa vendo
// "conectada" sem conseguir publicar. Aplica a mesma correção preventiva
// aqui, antes mesmo dessa integração ir ao ar, pra não repetir o mesmo bug.
async function invalidateMercadoLivreConnection(userId: string): Promise<void> {
  const admin = getAdminClient();
  const marketplaceId = await getMercadoLivreMarketplaceId();
  const { error } = await admin
    .from("marketplace_accounts")
    .update({ status: "disconnected", metadata: {} as unknown as never })
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId);
  if (error) throw error;
}

// Chama antes de qualquer publishProduct/callMercadoLivreApi — renova o
// access_token se estiver perto de expirar (margem de 5 min) e já salva o
// novo par de tokens (o refresh_token do ML é de uso único: sempre vem um
// novo a cada refresh, o antigo para de funcionar).
export async function getValidMercadoLivreAccessToken(userId: string): Promise<{
  accessToken: string;
}> {
  const conn = await getMercadoLivreConnection(userId);
  if (!conn) {
    throw new Error(
      "Loja Mercado Livre não conectada — conecte em Integrações antes de publicar.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at - now > 300) {
    return { accessToken: conn.access_token };
  }

  const { refreshAccessToken } = await import("@/lib/mercadolivre-api.server");
  try {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    await saveMercadoLivreConnection(refreshed, userId);
    return { accessToken: refreshed.accessToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid_grant|invalid_token|invalid_client/i.test(message)) {
      await invalidateMercadoLivreConnection(userId);
      throw new Error(
        "Sua conexão com o Mercado Livre expirou ou foi desfeita do lado do Mercado Livre — reconecte a loja em Integrações antes de publicar.",
      );
    }
    throw err;
  }
}

// Token de uso único pra saber "qual usuário" iniciou o fluxo OAuth do
// Mercado Livre — mesmo mecanismo do createShopeeOAuthState/consumeShopeeOAuthState
// (ver shopee-connection.server.ts), só que numa tabela própria
// (`mercadolivre_oauth_state`) em vez de reaproveitar a da Shopee — mantém
// as duas integrações isoladas uma da outra (nada aqui pode arriscar
// quebrar o fluxo da Shopee, que já está em produção). Igual a
// shopee_oauth_state, essa tabela foi criada direto no SQL editor do
// Supabase (não existe migration commitada nem entrada em types.ts pra ela
// — por isso o cast `as any` abaixo), pelos mesmos motivos: sem CLI/bash
// disponível nesse ambiente pra gerar migration + tipos automaticamente.
export async function createMercadoLivreOAuthState(userId: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await (admin as any)
    .from("mercadolivre_oauth_state")
    .insert({ user_id: userId })
    .select("token")
    .single();
  if (error) throw error;
  return data.token as string;
}

export async function consumeMercadoLivreOAuthState(token: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await (admin as any)
    .from("mercadolivre_oauth_state")
    .select("user_id, created_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Link de conexão do Mercado Livre inválido ou expirado. Tente conectar de novo.");
  }
  await (admin as any).from("mercadolivre_oauth_state").delete().eq("token", token);
  const ageMs = Date.now() - new Date(data.created_at as string).getTime();
  if (ageMs > 10 * 60 * 1000) {
    throw new Error("Link de conexão do Mercado Livre expirado — tente conectar de novo.");
  }
  return data.user_id as string;
}
