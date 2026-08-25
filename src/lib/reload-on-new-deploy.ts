// Uma SPA que fica horas aberta na mesma aba nunca pega um deploy novo
// sozinha — o navegador só busca o JS atualizado numa navegação de verdade.
// Isso já causou um bug "fantasma": publicamos uma correção, mas quem já
// tinha o Shoppfy aberto continuou rodando o bundle antigo (com o bug),
// mesmo sem saber. Aqui a gente detecta isso comparando os arquivos JS que a
// página atual tem carregados com os que o servidor está servindo agora —
// se mudou, é porque saiu um deploy novo — e recarrega sozinho. Só verifica
// quando a aba está visível/em foco (nunca no meio do uso, pra não
// interromper nada) e só recarrega se realmente detectou uma versão nova.

function currentScriptSrcs(): string[] {
  return Array.from(document.querySelectorAll("script[src]"))
    .map((el) => el.getAttribute("src") ?? "")
    .filter(Boolean)
    .sort();
}

async function hasNewDeploy(): Promise<boolean> {
  try {
    const res = await fetch(window.location.pathname, { cache: "no-store" });
    if (!res.ok) return false;
    const html = await res.text();
    const freshSrcs = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g))
      .map((m) => m[1])
      .filter(Boolean)
      .sort();
    const current = currentScriptSrcs();
    if (freshSrcs.length === 0 || current.length === 0) return false;
    return JSON.stringify(freshSrcs) !== JSON.stringify(current);
  } catch {
    // Sem rede ou qualquer falha na checagem: assume que não mudou nada,
    // nunca força um reload por causa de um erro de verificação.
    return false;
  }
}

let watching = false;

export function watchForNewDeploy() {
  if (typeof window === "undefined" || watching) return;
  watching = true;

  const check = async () => {
    if (document.visibilityState !== "visible") return;
    if (await hasNewDeploy()) {
      window.location.reload();
    }
  };

  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  window.setInterval(check, 5 * 60_000);
}
