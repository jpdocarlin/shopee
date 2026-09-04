// Server-only client for the Shopee Open Platform API v2 — publicação direta
// de produto, sem depender da extensão de navegador.
// SECURITY: só usar a partir de outros *.server.ts ou via dynamic import
// dentro de um handler de servidor — nunca importar no topo de uma rota ou
// *.functions.ts (isso vazaria pro bundle do cliente).
//
// STATUS (03/09/2026): o app "Shoppfy" no console da Shopee Open Platform
// está em "Developing" (sandbox) — as credenciais abaixo (SHOPEE_TEST_*) só
// funcionam com lojas de teste (ver Test Account-Sandbox v2 no console).
// Publicar na loja REAL da Shopee exige que o Jp clique em "Go-Live" no
// console e passe pela revisão deles — o que, por sua vez, normalmente exige
// mostrar chamadas de API já funcionando (por isso testar em sandbox
// primeiro é o caminho obrigatório, não só recomendado).
//
// Doc oficial (open.shopee.com/developer-guide) está bloqueada pro fetch
// automatizado — o fluxo de auth abaixo foi confirmado contra múltiplas
// fontes (guia de terceiros + exemplos de SDK). O schema exato de
// product.add_item pode variar por categoria (cada categoria da Shopee tem
// atributos obrigatórios diferentes) — publishProduct() abaixo cobre o caso
// comum, mas precisa ser validado contra a "API Test Tool" do console (ou
// contra uma chamada real em sandbox) antes de confiar 100% nele em produção.
import crypto from "node:crypto";

// Host de sandbox confirmado direto na "API Test Tool" do console da Shopee
// (que assina as chamadas pra gente) — NÃO é o "partner.test-stable.shopeemobile.com"
// que aparece em vários SDKs/exemplos antigos por aí. Foi esse host errado que
// causava "error_sign" ("Wrong sign") em toda chamada, mesmo com partner_id e
// partner_key corretos (confirmado rodando get_shops_by_partner na API Test
// Tool: só funcionou trocando pra este host).
const HOST = process.env.SHOPEE_ENV === "live"
  ? "https://partner.shopeemobile.com"
  : "https://openplatform.sandbox.test-stable.shopee.sg";

function requireCreds(): { partnerId: number; partnerKey: string } {
  const isLive = process.env.SHOPEE_ENV === "live";
  const partnerId = isLive ? process.env.SHOPEE_PARTNER_ID : process.env.SHOPEE_TEST_PARTNER_ID;
  const partnerKey = isLive ? process.env.SHOPEE_PARTNER_KEY : process.env.SHOPEE_TEST_PARTNER_KEY;
  if (!partnerId || !partnerKey) {
    throw new Error(
      "Credenciais da Shopee Open Platform não configuradas (SHOPEE_TEST_PARTNER_ID / SHOPEE_TEST_PARTNER_KEY no .env).",
    );
  }
  return { partnerId: Number(partnerId), partnerKey };
}

function sign(baseString: string, partnerKey: string): string {
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

// Monta o link que o Jp precisa abrir e logar com a conta da loja pra
// autorizar o Shoppfy — a Shopee redireciona de volta pra `redirectUrl` com
// `?code=...&shop_id=...` na query.
export function buildAuthLink(redirectUrl: string): string {
  const { partnerId, partnerKey } = requireCreds();
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}`;
  const signature = sign(baseString, partnerKey);

  const url = new URL(`${HOST}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  url.searchParams.set("redirect", redirectUrl);
  return url.toString();
}

export type ShopeeTokenSet = {
  accessToken: string;
  refreshToken: string;
  shopId: number;
  expiresAt: number; // epoch seconds
};

// Troca o `code` (recebido no callback) pelo par access_token/refresh_token.
export async function exchangeCodeForToken(code: string, shopId: number): Promise<ShopeeTokenSet> {
  const { partnerId, partnerKey } = requireCreds();
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}`;
  const signature = sign(baseString, partnerKey);

  const url = new URL(`${HOST}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, shop_id: shopId, partner_id: partnerId }),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[Shopee] falha ao trocar code por token: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    shopId,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expire_in ?? 14400),
  };
}

// access_token dura só 4h — troca pelo refresh_token (válido por 30 dias)
// bem antes de expirar.
export async function refreshAccessToken(
  refreshToken: string,
  shopId: number,
): Promise<ShopeeTokenSet> {
  const { partnerId, partnerKey } = requireCreds();
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}`;
  const signature = sign(baseString, partnerKey);

  const url = new URL(`${HOST}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, shop_id: shopId, partner_id: partnerId }),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[Shopee] falha ao renovar token: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    shopId,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expire_in ?? 14400),
  };
}

// Chamada genérica e autenticada (assina com access_token + shop_id) pra
// qualquer endpoint v2 — usa isso pra listar categorias, atributos,
// canais de logística, etc. antes de publicar de verdade.
export async function callShopeeApi<T = unknown>(
  path: string,
  {
    method = "GET",
    accessToken,
    shopId,
    query,
    body,
  }: {
    method?: "GET" | "POST";
    accessToken: string;
    shopId: number;
    query?: Record<string, string | number>;
    body?: unknown;
  },
): Promise<T> {
  const { partnerId, partnerKey } = requireCreds();
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(baseString, partnerKey);

  const url = new URL(`${HOST}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", String(shopId));
  if (query) {
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[Shopee] ${path} falhou: ${JSON.stringify(json)}`);
  }
  return json as T;
}

// Lista as categorias da Shopee (BR) — passo obrigatório antes de publicar,
// já que category_id é exigido e precisa ser um id válido da árvore deles.
export function getCategoryList(accessToken: string, shopId: number) {
  return callShopeeApi("/api/v2/product/get_category", { accessToken, shopId, query: { language: "pt-br" } });
}

// Atributos obrigatórios/opcionais de uma categoria específica — cada
// categoria da Shopee exige um conjunto diferente (ex: "Marca", "Voltagem").
// Sem isso, product/add_item devolve erro de validação pra categorias com
// atributo obrigatório não preenchido.
export function getAttributeTree(accessToken: string, shopId: number, categoryId: number) {
  return callShopeeApi("/api/v2/product/get_attribute_tree", {
    accessToken,
    shopId,
    query: { category_id: categoryId, language: "pt-br" },
  });
}

// Canais de logística habilitados na loja — também exigido em
// product/add_item (logistic_info).
export function getLogisticsChannelList(accessToken: string, shopId: number) {
  return callShopeeApi("/api/v2/logistics/get_channel_list", { accessToken, shopId });
}

// Sobe uma imagem pro CDN da Shopee — devolve um image_id pra usar em
// product/add_item (a Shopee não aceita URL de imagem externa direto).
export async function uploadProductImage(
  accessToken: string,
  shopId: number,
  imageUrl: string,
): Promise<string> {
  const { partnerId, partnerKey } = requireCreds();
  const path = "/api/v2/media_space/upload_image";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(baseString, partnerKey);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`[Shopee] não consegui baixar a imagem: ${imageUrl}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const form = new FormData();
  form.append("image", new Blob([imgBuffer]), "produto.jpg");

  const url = new URL(`${HOST}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", String(shopId));

  const res = await fetch(url.toString(), { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[Shopee] upload de imagem falhou: ${JSON.stringify(json)}`);
  }
  return json.response.image_info.image_id as string;
}

export type PublishProductInput = {
  accessToken: string;
  shopId: number;
  categoryId: number;
  itemName: string; // até 120 caracteres
  description: string;
  originalPrice: number; // em reais
  stock: number;
  weightKg: number;
  imageIds: string[]; // ver uploadProductImage()
  logisticIds: number[]; // ids habilitados, ver getLogisticsChannelList()
};

// Publica o produto de verdade na Shopee. IMPORTANTE: isso ainda não foi
// testado contra uma chamada real (sandbox down no momento em que foi
// escrito) — antes de plugar no botão "Publicar" do Criar Anúncio, testar
// esse fluxo ponta a ponta com um produto de teste e conferir o retorno.
export async function publishProduct(input: PublishProductInput) {
  const { accessToken, shopId, categoryId, itemName, description, originalPrice, stock, weightKg, imageIds, logisticIds } = input;

  return callShopeeApi("/api/v2/product/add_item", {
    method: "POST",
    accessToken,
    shopId,
    body: {
      original_price: originalPrice,
      description,
      weight: weightKg,
      item_name: itemName.slice(0, 120),
      category_id: categoryId,
      normal_stock: stock,
      image: { image_id_list: imageIds },
      logistic_info: logisticIds.map((logistic_id) => ({ logistic_id, enabled: true })),
    },
  });
}
