// Uma SPA que fica horas aberta na mesma aba nunca pega um deploy novo
// sozinha — o navegador só busca o JS atualizado numa navegação de verdade.
// Isso já causou um bug "fantasma": publicamos uma correção, mas quem já
// tinha o Shoppfy aberto continuou rodando o bundle antigo (com o bug),
// mesmo sem saber. Aqui a gente detecta isso comparando os arquivos JS que a
// página atual tem carregados com os que o servidor está servindo agora —
// se mudou, é porque saiu um deploy novo — e recarrega sozinho. Só verifica
// quando a aba está visível/em foco (nunca no meio do uso, pra não
// interromper nada) e só recarrega se realmente detectou uma versão nova.

// 23/09/2026: descoberto ao vivo — a causa real do vídeo da aula "travando e
// reiniciando toda hora" NÃO era o player em si, era este arquivo. Ele
// comparava TODO `<script src>` presente no documento (`querySelectorAll`
// sem filtro nenhum) contra o HTML puro de uma nova busca da mesma URL. Só
// que o player de aula do YouTube injeta os próprios scripts dele
// (`youtube.com/iframe_api` + o widget interno que a própria API do YouTube
// carrega em seguida) direto no `<head>` via `document.createElement` — e
// esses dois scripts, sendo de outra origem, nunca aparecem numa busca fresca
// do HTML da página (esse HTML só lista os scripts do PRÓPRIO app). Resultado:
// assim que uma aula com vídeo do YouTube carregava, a comparação ficava
// permanentemente "diferente" — nem que fosse por causa de um script que a
// gente nunca serviu — e a primeira checagem (15s depois de abrir a página)
// já forçava um `location.reload()`; a aula recarregava, o player do YouTube
// injetava os scripts de novo, e o ciclo se repetia a cada nova checagem
// (2 em 2 min, mais toda vez que a aba voltava a ficar visível ou a internet
// reconectava) — dá exatamente "trava no meio e reinicia toda hora assistindo".
// Confirmado ao vivo comparando os dois lados manualmente numa aula real: a
// única diferença entre o DOM atual e o HTML fresco eram os dois scripts do
// YouTube.
// Fix: só considerar scripts da MESMA origem do próprio app (isso é o que de
// fato indica um deploy novo) — qualquer script de terceiro injetado depois
// do carregamento inicial (YouTube hoje; fontes, analytics, outro widget
// amanhã) fica de fora da comparação.
function isSameOriginScript(src: string): boolean {
  try {
    return new URL(src, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function currentScriptSrcs(): string[] {
  return Array.from(document.querySelectorAll("script[src]"))
    .map((el) => el.getAttribute("src") ?? "")
    .filter(Boolean)
    .filter(isSameOriginScript)
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
  // Primeira checagem logo depois de montar — não espera 5 min nem depender
  // de trocar de aba/voltar o foco. Pega o caso de quem já estava com o
  // Shoppfy aberto numa aba única e sem trocar de foco quando saiu um deploy
  // novo (foi exatamente isso que causou o catálogo C7Drop mostrando custo
  // desatualizado pra quem tinha aberto antes do último deploy).
  window.setTimeout(check, 15_000);
  window.setInterval(check, 2 * 60_000);
}
