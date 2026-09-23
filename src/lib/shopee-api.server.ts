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
import { ProxyAgent } from "undici";

// IP fixo (QuotaGuard) exigido pela Shopee no formulário de Go-Live ("APP IP
// Address Management") — a Vercel não tem IP de saída fixo por padrão em
// funções serverless, e a Shopee quer pelo menos um IP declarado por onde as
// chamadas da API saem. QUOTAGUARDSTATIC_URL vem do dashboard do QuotaGuard
// (formato http://usuario:senha@host:porta). Passa via `dispatcher` só nas
// chamadas fetch deste arquivo (não usamos setGlobalDispatcher pra não afetar
// outras integrações do app, como Supabase/Gemini/Creatomate).
const shopeeProxyAgent = process.env.QUOTAGUARDSTATIC_URL
  ? new ProxyAgent(process.env.QUOTAGUARDSTATIC_URL)
  : undefined;

function shopeeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!shopeeProxyAgent) return fetch(url, init);
  return fetch(url, { ...init, dispatcher: shopeeProxyAgent } as RequestInit);
}

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

  const res = await shopeeFetch(url.toString(), {
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

  const res = await shopeeFetch(url.toString(), {
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

  const res = await shopeeFetch(url.toString(), {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    // 17/09/2026: descoberto ao vivo — "error_kyc_auth" é uma trava da
    // própria Shopee, não um bug do nosso código: a loja acabou de conectar
    // via OAuth, mas o vendedor ainda não terminou o cadastro completo
    // (KYC — verificação de identidade + dados bancários) no Seller Center
    // deles. Enquanto isso não for feito do lado da Shopee, QUALQUER
    // chamada de API de produto (get_category, get_attribute_tree,
    // add_item, ...) devolve esse mesmo erro pra ESSA loja específica —
    // reconectar, trocar de produto ou qualquer coisa do nosso lado não
    // resolve. callShopeeApi é o único ponto por onde toda chamada passa,
    // então intercepta aqui uma vez só e já cobre os 5+ endpoints
    // diferentes que podiam devolver isso, em vez de repetir a checagem em
    // cada função que chama a API.
    if (json.error === "error_kyc_auth") {
      throw new Error(
        "Sua loja Shopee ainda não completou o cadastro de vendedor exigido pela própria Shopee (verificação de identidade + dados bancários). Acesse o Seller Center (seller.shopee.com.br), finalize o cadastro em Minha Loja > Informações da Loja, e tente publicar de novo — isso não é algo que dá pra pular por aqui.",
      );
    }
    throw new Error(`[Shopee] ${path} falhou: ${JSON.stringify(json)}`);
  }
  return json as T;
}

export type ShopeeItemBaseInfo = {
  item_id: number;
  item_name: string;
  item_status: string;
  price_info?: Array<{ current_price: number }>;
  image?: { image_url_list?: string[] };
};

// Busca os dados reais do anúncio já publicado (título, foto, preço, status)
// — usado pra mostrar "o que ficou de verdade na Shopee" depois de
// publicar, já que o sandbox não tem uma loja/vitrine navegável pra
// conferir visualmente como num site de produção.
export async function getItemBaseInfo(
  accessToken: string,
  shopId: number,
  itemId: number,
): Promise<ShopeeItemBaseInfo | null> {
  const json = await callShopeeApi<{
    response?: { item_list?: ShopeeItemBaseInfo[] };
  }>("/api/v2/product/get_item_base_info", {
    accessToken,
    shopId,
    query: {
      item_id_list: String(itemId),
      need_tax_info: "false",
      need_complaint_policy: "false",
    },
  });
  return json.response?.item_list?.[0] ?? null;
}

export type ShopeeCategory = {
  category_id: number;
  // 16/09/2026: corrigido -- o get_category v2 da Shopee NÃO devolve um campo
  // "category_name" (esse nome nunca existiu na resposta real da API). O nome
  // localizado vem em "display_category_name" (tem também "original_category_name"
  // em inglês). Esse campo errado era a causa raiz do auto-match de categoria
  // nunca achar nada: como `category_name` sempre vinha undefined, TODO path
  // caía no fallback "Categoria {id}" (só números), então nenhuma palavra do
  // título/nicho batia com nada -- confirmado ao vivo com 3 produtos de nichos
  // bem diferentes (luminária, fone de ouvido, smartphone), os 3 bloqueados
  // por "não identificamos a categoria certa".
  display_category_name: string;
  parent_category_id: number;
  has_children: boolean;
};

// Lista TODAS as categorias da loja conectada (folhas e ramos) — passo
// obrigatório antes de publicar, já que category_id é exigido e precisa ser
// um id válido da árvore deles. Devolve a árvore inteira (não só as folhas)
// porque o auto-match de categoria em criar-anuncio.tsx precisa dos nomes
// dos ramos pra montar o caminho completo (ex.: "Casa e Decoração >
// Ferramentas > Furadeiras") — o nome da folha sozinho raramente contém a
// palavra-chave do nicho. Quem só precisa das folhas (as únicas aceitas em
// product/add_item) filtra com `!c.has_children` depois de montar o caminho.
// 09/09/2026: trocado de language "en" pra "pt-br" — agora que a loja é a
// BR real (pós Go-Live), pedir em inglês só atrapalhava o casamento por
// palavra-chave com os nichos do catálogo (que estão em português).
export async function getCategoryList(
  accessToken: string,
  shopId: number,
): Promise<ShopeeCategory[]> {
  const json = await callShopeeApi<{ response: { category_list: ShopeeCategory[] } }>(
    "/api/v2/product/get_category",
    { accessToken, shopId, query: { language: "pt-br" } },
  );
  return json.response.category_list;
}

// Formato de ENVIO (product/add_item) — confirmado contra o schema oficial
// da Shopee (23/09/2026, depois de um erro real em produção): `value_id` é
// OBRIGATÓRIO sempre, mesmo em texto livre — nesse caso manda `0`.
// Omitir o campo (em vez de mandar 0) é o que causava
// "AttributeValue.ValueId: ValueId is required" mesmo em atributos que
// aceitam original_value_name.
export type ShopeeAttributeValue = {
  value_id: number;
  original_value_name?: string;
};

// Formato de RESPOSTA (get_attribute_tree) — confirmado ao vivo em
// 04/09/2026 via dump bruto do JSON (ver histórico): a Shopee devolve
// `name` (não `original_attribute_name`) e `mandatory` (não
// `is_mandatory`). Os valores da lista também vêm com `name`, não
// `original_value_name` — esse campo só existe do lado do ENVIO.
export type ShopeeAttributeResponseValue = {
  value_id?: number;
  name?: string;
};

// input_type (confirmado contra o schema oficial da Shopee, 23/09/2026):
// 1 = dropdown seleção única, 2 = combo box seleção única (aceita valor
// customizado), 3 = texto livre, 4 = dropdown seleção múltipla, 5 = combo
// box seleção múltipla (aceita customizado). Os dois tipos de dropdown
// puro (1 e 4) NUNCA aceitam original_value_name — sempre exigem um
// value_id real, mesmo que a lista inline pareça vazia.
//
// support_search_value: quando true, a attribute_value_list que vem junto
// no get_attribute_tree é só uma AMOSTRA — a lista completa (com o
// value_id certo pro produto) precisa ser buscada em
// product/search_attribute_value_list. Alguns SDKs de terceiros documentam
// input_type/support_search_value aninhados dentro de um objeto
// `attribute_info`; como já confirmamos ao vivo que outros campos desse
// mesmo endpoint vêm PLANOS (não aninhados), a leitura abaixo aceita os
// dois formatos por segurança (ver getInputType/getSupportSearchValue).
export type ShopeeAttribute = {
  attribute_id: number;
  name: string;
  mandatory: boolean;
  input_type?: number;
  support_search_value?: boolean;
  attribute_info?: { input_type?: number; support_search_value?: boolean };
  attribute_value_list?: ShopeeAttributeResponseValue[];
};

function getInputType(attr: ShopeeAttribute): number | undefined {
  return attr.input_type ?? attr.attribute_info?.input_type;
}

function getSupportSearchValue(attr: ShopeeAttribute): boolean {
  return attr.support_search_value ?? attr.attribute_info?.support_search_value ?? false;
}

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
  const json = await callShopeeApi<{
    response?: { list?: Array<{ category_id: number; attribute_tree?: ShopeeAttribute[] }> };
  }>("/api/v2/product/get_attribute_tree", {
    accessToken,
    shopId,
    query: { category_id_list: categoryId, language: "pt-br" },
  });
  // 04/09/2026: shape confirmado ao vivo — `response.list[].attribute_tree`
  // (não `response.attribute_list` nem `response[].attribute_list`, os dois
  // palpites errados testados antes). Achata todas as entradas de `list`
  // por segurança (na prática, um só category_id_list devolve 1 entrada).
  const list = json.response?.list ?? [];
  return list.flatMap((entry) => entry.attribute_tree ?? []);
}

// Busca a lista completa de valores válidos de um atributo — necessário
// quando support_search_value é true, porque nesse caso a
// attribute_value_list que vem junto no get_attribute_tree é só uma
// amostra (às vezes vazia), não a lista real. Sem isso, atributos desse
// tipo ficam sem um value_id válido pra mandar no add_item.
// 23/09/2026: um comentário antigo aqui dizia que esse endpoint "nem
// existe" (404) — isso foi medido só contra o sandbox de teste (Singapura),
// que costuma ter metadado incompleto pras categorias fictícias dele. Em
// produção (loja BR real) o endpoint existe e funciona normalmente.
export async function searchAttributeValueList(
  accessToken: string,
  shopId: number,
  attributeId: number,
): Promise<ShopeeAttributeResponseValue[]> {
  const json = await callShopeeApi<{
    response?: { value_list?: Array<{ value_id: number; value_name: string }> };
  }>("/api/v2/product/search_attribute_value_list", {
    accessToken,
    shopId,
    query: { attribute_id: attributeId, cursor: 0, limit: 20 },
  });
  return (json.response?.value_list ?? []).map((v) => ({
    value_id: v.value_id,
    name: v.value_name,
  }));
}

// 04/09/2026: descoberto ao vivo — toda categoria exige um conjunto de
// atributos obrigatórios diferente. Pra destravar a publicação em QUALQUER
// categoria sem montar uma tela de formulário dinâmico, resolve cada
// atributo obrigatório automaticamente. Isso não faz sentido pra um
// catálogo real (o valor é arbitrário), mas é o suficiente pra passar na
// validação da Shopee.
//
// 23/09/2026: reescrito depois de um erro real em produção
// ("AttributeValue.ValueId: ValueId is required") em categorias fora do
// sandbox. Duas causas raiz, confirmadas contra o schema oficial da
// Shopee:
// 1. `value_id` é um campo OBRIGATÓRIO no envio — omitir ele (em vez de
//    mandar 0 em texto livre) já derrubava a validação sozinho.
// 2. Atributos com `support_search_value: true` só devolvem uma AMOSTRA em
//    get_attribute_tree — a lista completa (com o value_id certo) precisa
//    ser buscada em search_attribute_value_list antes de decidir se cai em
//    texto livre.
// Também passou a respeitar input_type: dropdown puro (1 e 4) nunca aceita
// original_value_name, então nesse caso nunca inventa texto livre — só
// tenta achar um value_id real (inline ou via busca).
export async function buildMandatoryAttributeList(
  accessToken: string,
  shopId: number,
  attributes: ShopeeAttribute[],
): Promise<Array<{ attribute_id: number; attribute_value_list: ShopeeAttributeValue[] }>> {
  const mandatory = attributes.filter((attr) => attr.mandatory);
  const result: Array<{ attribute_id: number; attribute_value_list: ShopeeAttributeValue[] }> = [];

  for (const attr of mandatory) {
    let candidates = attr.attribute_value_list ?? [];

    if (getSupportSearchValue(attr) && candidates.length === 0) {
      try {
        candidates = await searchAttributeValueList(accessToken, shopId, attr.attribute_id);
      } catch {
        // segue com a amostra (vazia) — melhor tentar publicar do que travar tudo.
      }
    }

    const firstValue = candidates[0];
    const isPureDropdown = getInputType(attr) === 1 || getInputType(attr) === 4;

    const value: ShopeeAttributeValue =
      firstValue?.value_id !== undefined
        ? { value_id: firstValue.value_id }
        : isPureDropdown
          ? // Dropdown puro sem nenhum valor descoberto — não existe texto
            // livre "seguro" pra inventar aqui (diferente de combo
            // box/texto livre). Manda 0 mesmo assim: se a Shopee recusar,
            // ao menos aponta esse atributo específico em vez de mascarar.
            { value_id: 0 }
          : { value_id: 0, original_value_name: firstValue?.name ?? "Padrão" };

    result.push({ attribute_id: attr.attribute_id, attribute_value_list: [value] });
  }

  return result;
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

  const res = await shopeeFetch(url.toString(), { method: "POST", body: form });
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
// Corta um texto sem quebrar no meio de uma palavra — corta no último
// espaço antes do limite (ou no limite mesmo, se não achar espaço nenhum
// antes de chegar lá).
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

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

  const buildBody = (
    desc: string,
    attrs:
      Array<{ attribute_id: number; attribute_value_list: ShopeeAttributeValue[] }> | undefined,
  ) => ({
    original_price: originalPrice,
    description: desc,
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
    // 08/09/2026: descoberto ao vivo (produção) - add_item exige condition. Shoppfy só vende produto novo, entao usa sempre NEW.
    condition: "NEW",
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
    ...(attrs && attrs.length > 0 ? { attribute_list: attrs } : {}),
  });

  // 09/09/2026: descoberto ao vivo — o limite de 200 caracteres visto em
  // 04/09 foi medido testando só 2 categorias da SANDBOX (ambiente de
  // teste, com categorias fictícias e limites artificiais). Aplicar esse
  // corte sempre, mesmo em produção, estava truncando a descrição de
  // anúncios reais no meio da frase (achado pelo Jp comparando o anúncio
  // publicado com o texto completo gerado na ferramenta). Em vez de
  // chutar um número fixo pra sempre, manda a descrição inteira (até um
  // teto generoso de 3000 caracteres — o maior limite documentado pela
  // Shopee) e só corta de verdade se a API reclamar do tamanho, lendo o
  // limite real direto da mensagem de erro dela.
  const GENEROUS_CAP = 3000;

  // 23/09/2026: descoberto ao vivo — get_attribute_tree nem sempre marca
  // `mandatory: true` pra todo atributo que a Shopee exige na validação
  // real do add_item. Categorias com atributos de compliance (ex.:
  // "Registration ID", "Model Name", "Manufacturer" numa categoria de
  // fechaduras) vêm reportadas como opcionais na árvore, mas o add_item
  // rejeita com "Attribute \"X\" is mandatory required" apontando IDs que
  // buildMandatoryAttributeList() nunca tentou preencher (porque não
  // sabia que eram obrigatórios). Em vez de tentar prever esse tipo de
  // regra condicional de antemão, detecta esse erro específico na
  // resposta (Rule Type: classification.attribute.mandatory), extrai os
  // IDs que faltaram e tenta de novo com um valor de texto livre padrão
  // pra cada um — cobre a maioria dos casos sem precisar de formulário
  // dinâmico por categoria.
  function parseMissingMandatoryAttributeIds(message: string): number[] {
    const ids = new Set<number>();
    const re = /Attribute is mandatory:\s*id:\s*(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(message))) ids.add(Number(match[1]));
    return [...ids];
  }

  let desc = truncateAtWordBoundary(description, GENEROUS_CAP);
  let attrs = attributeList;

  // Máximo 4 tentativas: cobre o caso de precisar corrigir tamanho de
  // descrição E atributos faltantes na mesma publicação (situações
  // independentes, cada uma consome uma tentativa).
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await callShopeeApi("/api/v2/product/add_item", {
        method: "POST",
        accessToken,
        shopId,
        body: buildBody(desc, attrs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      const descMatch = message.match(
        /description length must be between \d+ and (\d+) characters/i,
      );
      if (descMatch) {
        desc = truncateAtWordBoundary(description, Number(descMatch[1]));
        continue;
      }

      const missingIds = parseMissingMandatoryAttributeIds(message);
      if (missingIds.length > 0) {
        const already = new Set((attrs ?? []).map((a) => a.attribute_id));
        const newOnes = missingIds.filter((id) => !already.has(id));
        if (newOnes.length === 0) throw err; // já tentamos preencher esses — não repete em loop
        attrs = [
          ...(attrs ?? []),
          ...newOnes.map((attribute_id) => ({
            attribute_id,
            attribute_value_list: [{ value_id: 0, original_value_name: "Padrão" }],
          })),
        ];
        continue;
      }

      throw err;
    }
  }

  throw new Error("[Shopee] add_item falhou depois de tentativas automáticas de correção.");
}
