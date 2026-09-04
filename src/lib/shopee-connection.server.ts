// Server-only: guarda/lê a conexão da loja Shopee (tokens da API oficial) do
// único usuário admin do Shoppfy (ver src/lib/owner.ts — o produto é de uso
// pessoal do Jp, não multi-tenant, então não precisamos identificar "qual
// usuário" no callback do OAuth: é sempre o dono).
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

async function getShopeeMarketplaceId(): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.from("marketplaces").select("id").eq("slug", "shopee").maybeSingle();
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

export async function saveShopeeConnection(tokens: ShopeeTokenSet): Promise<void> {
  const admin = getAdminClient();
  const [userId, marketplaceId] = await Promise.all([getOwnerUserId(), getShopeeMarketplaceId()]);

  const metadata: ShopeeConnectionMetadata = {
    shopee_api: {
      shop_id: tokens.shopId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      environment: process.env.SHOPEE_ENV === "live" ? "live" : "sandbox",
    },
  };

  const { data: existing } = await admin
    .from("marketplace_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("marketplace_accounts")
      .update({ status: "active", metadata: metadata as unknown as never })
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

export async function getShopeeConnection(): Promise<ShopeeConnectionMetadata["shopee_api"] | null> {
  const admin = getAdminClient();
  const [userId, marketplaceId] = await Promise.all([getOwnerUserId(), getShopeeMarketplaceId()]);

  const { data, error } = await admin
    .from("marketplace_accounts")
    .select("metadata")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplaceId)
    .maybeSingle();
  if (error) throw error;

  const metadata = data?.metadata as ShopeeConnectionMetadata | undefined;
  return metadata?.shopee_api ?? null;
}

// Chama antes de qualquer publishProduct/callShopeeApi — renova o
// access_token se estiver perto de expirar (margem de 5 min) e já salva o
// novo par de tokens.
export async function getValidShopeeAccessToken(): Promise<{ accessToken: string; shopId: number }> {
  const conn = await getShopeeConnection();
  if (!conn) {
    throw new Error("Loja Shopee não conectada — conecte em Integrações antes de publicar.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at - now > 300) {
    return { accessToken: conn.access_token, shopId: conn.shop_id };
  }

  const { refreshAccessToken } = await import("@/lib/shopee-api.server");
  const refreshed = await refreshAccessToken(conn.refresh_token, conn.shop_id);
  await saveShopeeConnection(refreshed);
  return { accessToken: refreshed.accessToken, shopId: refreshed.shopId };
}
