// Server-only: guarda/lê a conexão da loja Shopee (tokens da API oficial) por
// usuário — cada conta do Shoppfy pode conectar a própria loja e publicar nela
// (marketplace_accounts é escopado por user_id). O `userId` usado aqui sempre
// vem do lado do servidor (context.userId de requireSupabaseAuth, ou do state
// de OAuth de uso único no callback) — nunca de um valor enviado pelo cliente.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ShopeeTokenSet } from "@/lib/shopee-api.server";

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

async function getOwnerUserId(): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Nenhum usuário com role admin encontrado.");
  return data.user_id;
}

// Publicar produto via API mexe na loja Shopee REAL do Jp (só ele conectou
// a conta) — mesmo a página Criar Anúncio sendo aberta a qualquer usuário do
// Shoppfy, ninguém além do dono pode disparar uma publicação de verdade
// (senão o produto de outro usuário apareceria na loja pessoal do Jp). Toda
// server function que chama a API da Shopee em nome da loja deve chamar
// isso primeiro com o `userId` que veio do `requireSupabaseAuth`.
export async function assertShopeeOwner(userId: string): Promise<void> {
  const ownerId = await getOwnerUserId();
  if (userId !== ownerId) {
    throw new Error("Só o dono da loja Shopee conectada pode fazer isso.");
  }
}

async function getShopeeMarketplaceId(): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("marketplaces")
    .select("id")
    .eq("slug", "shopee")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Marketplace "shopee" não encontrado na tabela marketplaces.');
  return data.id;
}

export type ShopeeConnectionMetadata = {
  shopee_api?: {
    shop_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: number;
    environment: "sandbox" | "live";
  };
};

// IMPORTANTE (04/09/2026): a tabela marketplace_accounts NÃO tem constraint
// de unicidade em (user_id, marketplace_id) — a conta do dono já tinha 6
// linhas "Conta Shopee" (metadata vazio) sobrando da função antiga de
// afiliados via extensão. Um `.maybeSingle()` filtrado só por essas duas
// colunas quebra nesse cenário: o Postgrest devolve erro de "multiple rows"
// quando bate mais de uma linha, e se o `error` não é checado (como estava
// aqui) o código segue com `existing = undefined` e insere uma linha nova a
// cada conexão — e se o `error` É checado (como em getShopeeConnection),
// a função inteira lança e o status vira "desconectado" mesmo com o token
// certo já salvo. Corrigido usando `.limit(1)` + `order(updated_at desc)` em
// vez de `.maybeSingle()`, que nunca lança por causa de múltiplas linhas e
// sempre opera na mais recente.
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

export async function saveShopeeConnection(tokens: ShopeeTokenSet, userId: string): Promise<void> {
  const admin = getAdminClient();
  const marketplaceId = await getShopeeMarketplaceId();

  const metadata: ShopeeConnectionMetadata = {
    shopee_api: {
      shop_id: tokens.shopId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      environment: process.env.SHOPEE_ENV === "live" ? "live" : "sandbox",
    },
  };

  const existing = await findExistingAccountRow(admin, userId, marketplaceId);

  if (existing) {
    const { error } = await admin
      .from("marketplace_accounts")
      .update({
        status: "active",
        label: "Loja Shopee (API oficial)",
        metadata: metadata as unknown as never,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("marketplace_accounts").insert({
      user_id: userId,
      marketplace_id: marketplaceId,
      label: "Loja Shopee (API oficial)",
      status: "active",
      metadata: metadata as unknown as never,
    });
    if (error) throw error;
  }
}

export async function getShopeeConnection(userId: string): Promise<
  ShopeeConnectionMetadata["shopee_api"] | null
> {
  const admin = getAdminClient();
  const marketplaceId = await getShopeeMarketplaceId();

  const { data, error } = await admin
    .from("marketplace_accounts")
    .select("metadata")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const metadata = data?.[0]?.metadata as ShopeeConnectionMetadata | undefined;
      const conn = metadata?.shopee_api ?? null;
      const currentEnv = process.env.SHOPEE_ENV === "live" ? "live" : "sandbox";
      if (conn && conn.environment !== currentEnv) return null;
      return conn;
}
// Chama antes de qualquer publishProduct/callShopeeApi — renova o
// access_token se estiver perto de expirar (margem de 5 min) e já salva o
// novo par de tokens.
export async function getValidShopeeAccessToken(userId: string): Promise<{
  accessToken: string;
  shopId: number;
}> {
  const conn = await getShopeeConnection(userId);
  if (!conn) {
    throw new Error("Loja Shopee não conectada — conecte em Integrações antes de publicar.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at - now > 300) {
    return { accessToken: conn.access_token, shopId: conn.shop_id };
  }

  const { refreshAccessToken } = await import("@/lib/shopee-api.server");
  const refreshed = await refreshAccessToken(conn.refresh_token, conn.shop_id);
  await saveShopeeConnection(refreshed, userId);
  return { accessToken: refreshed.accessToken, shopId: refreshed.shopId };
}

// Token de uso único pra saber "qual usuário" iniciou o fluxo OAuth da
// Shopee. O callback da Shopee (/api/shopee/callback) é um redirect puro do
// navegador, sem Authorization header, então não dá pra usar
// requireSupabaseAuth ali pra descobrir quem está conectando. Em vez disso,
// /api/shopee/connect (que roda depois de um clique autenticado na tela de
// Integrações) cria esse token aqui, embute na URL de redirect que manda pra
// Shopee, e o callback consome (uso único, expira em 10 min) pra saber em
// qual usuário salvar os tokens.
export async function createShopeeOAuthState(userId: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await (admin as any)
    .from("shopee_oauth_state")
    .insert({ user_id: userId })
    .select("token")
    .single();
  if (error) throw error;
  return data.token as string;
}

export async function consumeShopeeOAuthState(token: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await (admin as any)
    .from("shopee_oauth_state")
    .select("user_id, created_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Link de conexão da Shopee inválido ou expirado. Tente conectar de novo.");
  await (admin as any).from("shopee_oauth_state").delete().eq("token", token);
  const ageMs = Date.now() - new Date(data.created_at as string).getTime();
  if (ageMs > 10 * 60 * 1000) {
    throw new Error("Link de conexão da Shopee expirado — tente conectar de novo.");
  }
  return data.user_id as string;
}
