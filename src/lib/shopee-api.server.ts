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
const HOST =
  process.env.SHOPEE_ENV === "live"
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

export type ShopeeCategory = {
  category_id: number;
  category_name: string;
  parent_category_id: number;
  has_children: boolean;
};

// Lista as categorias da loja conectada — passo obrigatório antes de
// publicar, já que category_id é exigido e precisa ser um id válido da
// árvore deles (a árvore muda por região: a loja de teste sandbox usada
// hoje é de Singapura, então os nomes vêm em inglês — o mapeamento pra
// categorias em português só faz sentido depois do Go-Live com a loja BR
// real). Só devolve as categorias-folha (has_children: false), que são as
// únicas aceitas em product/add_item.
export async function getCategoryList(
  accessToken: string,
  shopId: number,
): Promise<ShopeeCategory[]> {
  const json = await callShopeeApi<{ response: { category_list: ShopeeCategory[] } }>(
    "/api/v2/product/get_category",
    { accessToken, shopId, query: { language: "en" } },
  );
  return json.response.category_list.filter((c) => !c.has_children);
}

export type ShopeeAttributeValue = {
  value_id?: number;
  original_value_name?: string;
};

export type ShopeeAttribute = {
  attribute_id: number;
  original_attribute_name: string;
  is_mandatory: boolean;
  input_validation_type?: string;
  attribute_value_list?: ShopeeAttributeValue[];
};

// Atributos obrigatórios/opcionais de uma categoria específica — cada
// categoria da Shopee exige um conjunto diferente e, na loja sandbox, os
// nomes são literalmente aleatórios ("hello world", "malaysiaku", "Battery
// Type") — não tem como adivinhar. Sem isso, product/add_item devolve erro
// de validação pra categorias com atributo obrigatório não preenchido.
export async function getAttributeTree(
  accessToken: string,
  shopId: number,
  categoryId: number,
): Promise<ShopeeAttribute[]> {
  // 04/09/2026: descoberto ao vivo — o parâmetro certo é `category_id_list`
  // (plural), não `category_id` — a Shopee devolvia "CategoryIdList is
  // required" com o nome no singular.
  const json = await callShopeeApi<Record<string, unknown>>(
    "/api/v2/product/get_attribute_tree",
    { accessToken, shopId, query: { category_id_list: categoryId, language: "pt-br" } },
  );
  // 04/09/2026 DEBUG TEMPORÁRIO: o shape exato da resposta ainda não bateu
  // com o esperado (tentativa 2) — joga o JSON bruto pra descobrir o
  // formato certo antes de tirar esse debug.
  throw new Error(`DEBUG raw get_attribute_tree: ${JSON.stringify(json).slice(0, 1500)}`);
}

// 04/09/2026: descoberto ao vivo — toda categoria da loja sandbox exige N
// atributos obrigatórios com nomes/valores de teste sem sentido nenhum
// ("hello world", "malaysiaku"...). Pra destravar a publicação em QUALQUER
// categoria sem montar uma tela de formulário dinâmico, resolve cada
// atributo obrigatório automaticamente: se tiver lista de valores válidos
// (combo box), usa o primeiro; se for campo livre (sem lista), preenche com
// um texto genérico. Isso não faz sentido pra um catálogo real (o valor é
// arbitrário), mas é o suficiente pra passar na validação da Shopee.
export function buildMandatoryAttributeList(
  attributes: ShopeeAttribute[],
): Array<{ attribute_id: number; attribute_value_list: ShopeeAttributeValue[] }> {
  return attributes
    .filter((attr) => attr.is_mandatory)
    .map((attr) => {
      const firstValue = attr.attribute_value_list?.[0];
      const value: ShopeeAttributeValue = firstValue?.value_id
        ? { value_id: firstValue.value_id }
        : { original_value_name: firstValue?.original_value_name ?? "Padrão" };
      return { attribute_id: attr.attribute_id, attribute_value_list: [value] };
    });
}

export type ShopeeBrand = {
  brand_id: number;
  original_brand_name: string;
};

// 04/09/2026: descoberto ao vivo — algumas categorias da Shopee (ex: a
// 100021 usada no teste) recusam product/add_item com
// "product.error_invalid_brand" / "Brand information required" se o body
// não trouxer `brand`. get_brand_list devolve as marcas válidas PRA AQUELA
// categoria (cada categoria tem sua própria lista) — quando existe uma
// opção "No Brand" (bem comum), ela serve como marca genérica pra
// categorias que só exigem "algum" valor preenchido. Se a categoria não usa
// marca, a Shopee devolve lista vazia (não é erro).
export async function getBrandList(
  accessToken: string,
  shopId: number,
  categoryId: number,
): Promise<ShopeeBrand[]> {
  // 04/09/2026: descoberto ao vivo — get_brand_list exige `status` (filtro
  // de status da marca na Shopee: 1 = NORMAL, ou seja marcas ativas/válidas
  // pra usar num anúncio novo). Sem esse param a Shopee devolve
  // "product.error_param" / "status is required".
  const json = await callShopeeApi<{
    response: { brand_list: ShopeeBrand[] };
  }>("/api/v2/product/get_brand_list", {
    accessToken,
    shopId,
    query: { category_id: categoryId, offset: 0, page_size: 50, status: 1, language: "pt-br" },
  });
  return json.response.brand_list ?? [];
}

export type ShopeeLogisticsChannel = {
  logistics_channel_id: number;
  logistics_channel_name: string;
  enabled: boolean;
};

// Canais de logística habilitados na loja — também exigido em
// product/add_item (logistic_info). Só devolve os já habilitados na loja
// (enabled: true) — os desabilitados não podem ser usados num anúncio novo.
export async function getLogisticsChannelList(
  accessToken: string,
  shopId: number,
): Promise<ShopeeLogisticsChannel[]> {
  const json = await callShopeeApi<{
    response: { logistics_channel_list: ShopeeLogisticsChannel[] };
  }>("/api/v2/logistics/get_channel_list", { accessToken, shopId });
  return json.response.logistics_channel_list.filter((c) => c.enabled);
}

// Sobe os bytes de uma imagem pro CDN da Shopee — devolve um image_id pra
// usar em product/add_item (a Shopee não aceita URL de imagem externa
// direto). Núcleo compartilhado por uploadProductImage() (baixa de uma URL
// http) e uploadProductImageFromDataUrl() (decodifica um data: URL base64,
// como o que a geração de foto por IA devolve — sem precisar de um "fetch"
// de data: URL, que é redundante já que os bytes já estão em mãos).
async function uploadImageBuffer(
  accessToken: string,
  shopId: number,
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const { partnerId, partnerKey } = requireCreds();
  const path = "/api/v2/media_space/upload_image";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(baseString, partnerKey);

  // 04/09/2026: as fotos do catálogo C7Drop vêm em .webp (é como o Vercel
  // Blob guarda os uploads) — a Shopee rejeitava com "image is invalid or
  // not supported" (confirmado ao vivo), porque media_space/upload_image só
  // aceita JPG/PNG de verdade, não só o filename dizendo ".jpg". Reconverte
  // sempre pra JPEG aqui antes de subir, não importa o formato de origem.
  const { default: sharp } = await import("sharp");
  const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();

  const form = new FormData();
  form.append("image", new Blob([jpegBuffer], { type: "image/jpeg" }), filename);

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

export async function uploadProductImage(
  accessToken: string,
  shopId: number,
  imageUrl: string,
): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`[Shopee] não consegui baixar a imagem: ${imageUrl}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  return uploadImageBuffer(accessToken, shopId, imgBuffer, "produto.jpg");
}

// Foto gerada pela IA (generateEnhancedProductPhoto) vem como data URL
// (`data:image/jpeg;base64,...`) — decodifica direto em vez de dar fetch
// numa data: URL.
export async function uploadProductImageFromDataUrl(
  accessToken: string,
  shopId: number,
  dataUrl: string,
): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("[Shopee] data URL de imagem inválido.");
  const buffer = Buffer.from(match[2], "base64");
  return uploadImageBuffer(accessToken, shopId, buffer, "produto.jpg");
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
  brand?: { brandId: number; originalBrandName: string }; // ver getBrandList()
  attributeList?: Array<{ attribute_id: number; attribute_value_list: ShopeeAttributeValue[] }>; // ver buildMandatoryAttributeList()
};

// Publica o produto de verdade na Shopee. IMPORTANTE: isso ainda não foi
// testado contra uma chamada real (sandbox down no momento em que foi
// escrito) — antes de plugar no botão "Publicar" do Criar Anúncio, testar
// esse fluxo ponta a ponta com um produto de teste e conferir o retorno.
export async function publishProduct(input: PublishProductInput) {
  const {
    accessToken,
    shopId,
    categoryId,
    itemName,
    description,
    originalPrice,
    stock,
    weightKg,
    imageIds,
    logisticIds,
    brand,
    attributeList,
  } = input;

  return callShopeeApi("/api/v2/product/add_item", {
    method: "POST",
    accessToken,
    shopId,
    body: {
      original_price: originalPrice,
      // 04/09/2026: descoberto ao vivo — pelo menos duas categorias
      // sandbox rejeitaram a descrição gerada pela IA (~1000+ caracteres)
      // com "description length must be between 1 and 200 characters".
      // Corta em 200 por segurança — mesmo limite visto nas duas
      // categorias testadas até agora.
      description: description.slice(0, 200),
      weight: weightKg,
      item_name: itemName.slice(0, 120),
      category_id: categoryId,
      normal_stock: stock,
      // 04/09/2026: descoberto ao vivo — além de normal_stock (formato
      // antigo), a Shopee agora exige seller_stock (array, formato novo
      // multi-armazém) preenchido, senão add_item quebra com
      // "seller_stock, value must Not Null". Manda os dois pra cobrir as
      // duas validações.
      seller_stock: [{ stock }],
      // 04/09/2026: descoberto ao vivo — algumas categorias exigem as
      // dimensões do pacote ("Parcel size is required" / dimension is
      // mandatory). O formulário do Criar Anúncio ainda não coleta isso,
      // então manda um valor padrão conservador (pacote pequeno/médio) só
      // pra satisfazer a validação — não reflete a caixa real do produto.
      dimension: { package_length: 20, package_width: 20, package_height: 10 },
      image: { image_id_list: imageIds },
      logistic_info: logisticIds.map((logistic_id) => ({ logistic_id, enabled: true })),
      ...(brand
        ? { brand: { brand_id: brand.brandId, original_brand_name: brand.originalBrandName } }
        : {}),
      // 04/09/2026: descoberto ao vivo — toda categoria da loja sandbox
      // exige atributos obrigatórios diferentes (get_attribute_tree). Ver
      // buildMandatoryAttributeList() — quem chama publishProduct() já
      // resolve isso e manda pronto aqui.
      ...(attributeList && attributeList.length > 0 ? { attribute_list: attributeList } : {}),
    },
  });
}
