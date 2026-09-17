// Server-only client for the Mercado Livre API — publicação direta de
// produto na loja do próprio usuário, no mesmo espírito da integração da
// Shopee (ver shopee-api.server.ts, que serviu de modelo pra esse arquivo).
// SECURITY: só usar a partir de outros *.server.ts ou via dynamic import
// dentro de um handler de servidor — nunca importar no topo de uma rota ou
// *.functions.ts (isso vazaria pro bundle do cliente).
//
// STATUS (16/09/2026): implementado a partir da doc oficial
// (developers.mercadolivre.com.br) + WebSearch (o fetch automatizado direto
// na doc oficial ficou bloqueado, igual acontecia com a doc da Shopee) —
// ainda NÃO testado contra uma chamada real, porque falta o App ID/Client
// Secret do app do Mercado Livre (o Jp precisa criar em
// developers.mercadolivre.com.br/apps e configurar a Redirect URI abaixo).
// Antes de confiar 100% em produção, testar o fluxo ponta a ponta (conectar
// loja → publicar 1 produto de teste) e ajustar o que a API reclamar —
// mesmo processo que foi feito com a Shopee (add_item foi ajustado várias
// vezes contra erros reais dela).
//
// DIFERENÇAS relevantes vs. Shopee (mais simples nesses pontos):
// - Auth é OAuth2 padrão com Bearer token — sem assinatura HMAC por chamada
//   (a Shopee exige partner_id+timestamp+sign em toda requisição).
// - Não tem ambiente sandbox separado — é uma API só (produção), o teste
//   antes de ir "de verdade" é feito com uma conta de teste do próprio ML.
// - Fotos vão direto por URL no corpo do POST /items (`pictures: [{source}]`)
//   — não precisa subir bytes pra um endpoint de upload separado, como a
//   Shopee exige (media_space/upload_image).
// - Descrição do anúncio é um endpoint SEPARADO (POST /items/{id}/description
//   com { plain_text }) — não vai dentro do POST /items principal.
import { ProxyAgent } from "undici";

// Mesmo proxy de IP fixo (QuotaGuard) já usado pra Shopee — reaproveita a
// mesma env var (QUOTAGUARDSTATIC_URL). O Mercado Livre não exige IP fixo
// declarado como a Shopee faz no Go-Live, mas não custa sair pelo mesmo IP
// estável já configurado, evitando qualquer bloqueio por IP variável da
// Vercel.
const mlProxyAgent = process.env.QUOTAGUARDSTATIC_URL
  ? new ProxyAgent(process.env.QUOTAGUARDSTATIC_URL)
  : undefined;

function mlFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!mlProxyAgent) return fetch(url, init);
  return fetch(url, { ...init, dispatcher: mlProxyAgent } as RequestInit);
}

const AUTH_HOST = "https://auth.mercadolivre.com.br";
const API_HOST = "https://api.mercadolibre.com";
const SITE_ID = "MLB"; // Brasil

function requireCreds(): { appId: string; clientSecret: string } {
  const appId = process.env.MERCADOLIVRE_APP_ID;
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
  if (!appId || !clientSecret) {
    throw new Error(
      "Credenciais do Mercado Livre não configuradas (MERCADOLIVRE_APP_ID / MERCADOLIVRE_CLIENT_SECRET).",
    );
  }
  return { appId, clientSecret };
}

// Monta o link que o usuário precisa abrir e logar com a conta da loja pra
// autorizar o Shoppfy. `redirectUrl` tem que ser EXATAMENTE (sem query
// string extra) a Redirect URI cadastrada no app do Mercado Livre Developers
// — diferente da Shopee (que aceita qualquer URL dentro do domínio
// cadastrado), o ML valida a URI cadastrada à risca. Por isso o `state`
// (token de uso único, ver createMercadoLivreOAuthState em
// mercadolivre-connection.server.ts) vai como parâmetro OAuth padrão
// (`state=`) na URL de autorização — não embutido no redirect_uri — e o
// Mercado Livre devolve ele de volta no callback como `?state=...&code=...`,
// sem precisar que o redirect_uri tenha query string nenhuma.
export function buildAuthLink(redirectUrl: string, state: string): string {
  const { appId } = requireCreds();
  const url = new URL(`${AUTH_HOST}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUrl);
  url.searchParams.set("state", state);
  return url.toString();
}

export type MercadoLivreTokenSet = {
  accessToken: string;
  refreshToken: string;
  userId: number;
  expiresAt: number; // epoch seconds
};

// Troca o `code` (recebido no callback) pelo par access_token/refresh_token.
// `redirectUrl` tem que ser IDÊNTICA à usada em buildAuthLink (exigência do
// ML — troca de token falha com "invalid_grant" se a URI não bater exato).
export async function exchangeCodeForToken(
  code: string,
  redirectUrl: string,
): Promise<MercadoLivreTokenSet> {
  const { appId, clientSecret } = requireCreds();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: appId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUrl,
  });

  const res = await mlFetch(`${API_HOST}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`[Mercado Livre] falha ao trocar code por token: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    userId: json.user_id,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 21600),
  };
}

// access_token dura 6h — troca pelo refresh_token bem antes de expirar. O
// refresh_token do ML é de uso único: a cada refresh a API devolve um NOVO
// refresh_token, e o antigo para de funcionar (por isso saveMercadoLivreConnection
// sempre grava o par inteiro de novo, nunca só o access_token).
export async function refreshAccessToken(refreshToken: string): Promise<MercadoLivreTokenSet> {
  const { appId, clientSecret } = requireCreds();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await mlFetch(`${API_HOST}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`[Mercado Livre] falha ao renovar token: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    userId: json.user_id,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 21600),
  };
}

// Chamada genérica e autenticada (Bearer token) pra qualquer endpoint da API
// — bem mais simples que a Shopee, que exige assinatura HMAC em toda
// chamada.
export async function callMercadoLivreApi<T = unknown>(
  path: string,
  {
    method = "GET",
    accessToken,
    query,
    body,
  }: {
    method?: "GET" | "POST" | "PUT";
    accessToken: string;
    query?: Record<string, string | number>;
    body?: unknown;
  },
): Promise<T> {
  const url = new URL(`${API_HOST}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  }

  const res = await mlFetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    body: method !== "GET" ? JSON.stringify(body ?? {}) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`[Mercado Livre] ${path} falhou: ${JSON.stringify(json)}`);
  }
  return json as T;
}

export type MercadoLivreCategoryPrediction = {
  categoryId: string;
  categoryName: string;
  domainId: string | null;
  domainName: string | null;
};

// Diferente da Shopee (que não tem previsão de categoria — precisou de um
// matcher por palavra-chave escrito à mão em shopee-category-match.ts), o
// Mercado Livre tem um preditor OFICIAL de categoria por título
// (domain_discovery). Usa isso em vez de reinventar outro matcher — deve ser
// bem mais preciso, já que é treinado pela própria plataforma no catálogo
// real deles. Pega só o primeiro resultado (o de maior confiança); sem
// nenhum resultado, devolve null (mesma filosofia da Shopee: sem categoria
// confiável identificada, não publica, não deixa a pessoa escolher na mão).
export async function predictCategory(
  accessToken: string,
  title: string,
): Promise<MercadoLivreCategoryPrediction | null> {
  const json = await callMercadoLivreApi<
    Array<{ category_id: string; category_name: string; domain_id?: string; domain_name?: string }>
  >(`/sites/${SITE_ID}/domain_discovery/search`, {
    accessToken,
    query: { q: title, limit: 1 },
  });
  const top = json[0];
  if (!top) return null;
  return {
    categoryId: top.category_id,
    categoryName: top.category_name,
    domainId: top.domain_id ?? null,
    domainName: top.domain_name ?? null,
  };
}

export type MercadoLivreAttribute = {
  id: string;
  name: string;
  value_type: string;
  tags?: { required?: boolean; catalog_required?: boolean };
  values?: Array<{ id: string; name: string }>;
};

// Atributos (obrigatórios ou não) de uma categoria específica — cada
// categoria do ML exige um conjunto diferente (ex.: Celulares exige Marca,
// Modelo, Memória interna...). Espelha getAttributeTree da Shopee.
export async function getCategoryAttributes(
  accessToken: string,
  categoryId: string,
): Promise<MercadoLivreAttribute[]> {
  const json = await callMercadoLivreApi<MercadoLivreAttribute[]>(
    `/categories/${categoryId}/attributes`,
    { accessToken },
  );
  return json;
}

// Resolve automaticamente cada atributo marcado como obrigatório
// (tags.required) — sem montar um formulário dinâmico por categoria. Quando
// existe uma lista fechada de valores (`values`), usa o primeiro; sem lista
// (campo livre), manda um texto genérico. Espelha
// buildMandatoryAttributeList da Shopee — mesma limitação conhecida: o valor
// é arbitrário, só o suficiente pra passar na validação da API, não reflete
// um dado real do produto.
export function buildMandatoryAttributeList(
  attributes: MercadoLivreAttribute[],
): Array<{ id: string; value_name?: string; value_id?: string }> {
  return attributes
    .filter((attr) => attr.tags?.required)
    .map((attr) => {
      const firstValue = attr.values?.[0];
      if (firstValue) return { id: attr.id, value_id: firstValue.id, value_name: firstValue.name };
      return { id: attr.id, value_name: "Não informado" };
    });
}

export type PublishMercadoLivreProductInput = {
  accessToken: string;
  categoryId: string;
  itemName: string; // até 60 caracteres
  description: string;
  priceReais: number;
  stock: number;
  imageUrls: string[]; // URLs públicas — o ML busca direto, sem upload separado
  attributeList?: Array<{ id: string; value_name?: string; value_id?: string }>;
};

// Publica o produto de verdade no Mercado Livre. IMPORTANTE (16/09/2026):
// ainda não testado contra uma chamada real (sem credenciais do app ainda)
// — antes de confiar 100% em produção, testar esse fluxo ponta a ponta com
// um produto de teste e conferir o retorno, igual foi feito com a Shopee
// (que precisou de vários ajustes ao vivo: seller_stock, condition,
// dimension, brand, attribute_list — o ML provavelmente vai exigir ajustes
// parecidos assim que testado contra uma categoria real).
export async function publishProduct(
  input: PublishMercadoLivreProductInput,
): Promise<{ itemId: string; permalink: string | null }> {
  const { accessToken, categoryId, itemName, description, priceReais, stock, imageUrls, attributeList } =
    input;

  const body = {
    title: itemName.slice(0, 60),
    category_id: categoryId,
    price: priceReais,
    currency_id: "BRL",
    available_quantity: stock,
    buying_mode: "buy_it_now",
    condition: "new",
    // "gold_special" (Clássico) é o listing_type mais comum pra vendedor
    // pessoa física/pequeno — precisa validar contra a conta real do Jp se
    // esse é o tipo de anúncio disponível pra ela (algumas contas só têm
    // acesso a determinados tipos, dependendo da reputação/plano).
    listing_type_id: "gold_special",
    pictures: imageUrls.map((source) => ({ source })),
    ...(attributeList && attributeList.length > 0 ? { attributes: attributeList } : {}),
  };

  const created = await callMercadoLivreApi<{ id: string; permalink?: string }>("/items", {
    method: "POST",
    accessToken,
    body,
  });

  // Descrição é um endpoint separado no ML (POST /items/{id}/description),
  // diferente da Shopee (description vai dentro do add_item principal).
  // Falha aqui não deve derrubar a publicação inteira — o item já existe,
  // só fica sem descrição (melhor que perder o produto publicado).
  try {
    await callMercadoLivreApi(`/items/${created.id}/description`, {
      method: "POST",
      accessToken,
      body: { plain_text: description },
    });
  } catch (err) {
    console.error("[MercadoLivre] item publicado mas falhou ao salvar descrição:", err);
  }

  return { itemId: created.id, permalink: created.permalink ?? null };
}
