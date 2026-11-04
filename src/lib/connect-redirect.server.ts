// 04/11/2026: conexão de loja pelo "link pra janela anônima" (Integrações →
// Conectar → Abrir numa janela anônima). Nessa janela a pessoa não está logada
// na Shoppfy, então mandar ela de volta pra /integracoes cairia na tela de
// login. A rota /connect marca a janela com um cookie curto e o callback, ao
// ver o cookie, manda pra página pública /conectado ("pode fechar esta
// janela") — a aba original da Shoppfy percebe a conexão sozinha.
const COOKIE = "shoppfy_conn_via";

export type ConnectMarketplace = "shopee" | "mercado-livre";

export function viaLinkCookie(): string {
  return `${COOKIE}=link; Max-Age=900; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

// Conexão normal (sem link): limpa a marca, caso tenha sobrado de um link
// aberto neste mesmo navegador.
export function clearViaCookie(): string {
  return `${COOKIE}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

function cameFromLink(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(/;\s*/).some((c) => c === `${COOKIE}=link`);
}

/** Redirect 302 que aceita cabeçalhos extras (Response.redirect não deixa). */
export function redirectWith(location: string, setCookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

// Destino depois do callback: /integracoes (fluxo normal) ou /conectado
// (fluxo pelo link). `integracoesQuery` é o que já era usado antes
// (ex.: "shopee=connected", "ml=error&reason=missing_params").
export function afterConnectRedirect(
  request: Request,
  marketplace: ConnectMarketplace,
  ok: boolean,
  integracoesQuery: string,
): Response {
  const origin = new URL(request.url).origin;
  if (cameFromLink(request)) {
    const url = new URL("/conectado", origin);
    url.searchParams.set("loja", marketplace);
    url.searchParams.set("status", ok ? "ok" : "erro");
    return redirectWith(url.toString(), clearViaCookie());
  }
  return redirectWith(new URL(`/integracoes?${integracoesQuery}`, origin).toString());
}
