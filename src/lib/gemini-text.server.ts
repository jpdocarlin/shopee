// Server-only client do Gemini para geração de TEXTO (mini-história do post).
// SECURITY: só pode ser importado dentro de handlers de server function (via
// import dinâmico) — nunca no topo de uma rota ou de um *.functions.ts, que
// vão pro bundle do cliente. Mesma regra do gemini-image.server.ts.
import { formatBRL } from "@/lib/format";

// Modelo de texto rápido e com tier gratuito generoso — a história é curta,
// não precisa de um modelo grande.
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};

export type ProductStoryInput = {
  title: string;
  category?: string;
  priceCents?: number;
  originalPriceCents?: number | null;
  link?: string;
  // Muda a cada clique em "Regenerar" — entra no prompt só pra empurrar o
  // modelo pra uma variação diferente da mesma história.
  variant?: number;
};

function requireApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const message =
      "GEMINI_API_KEY não configurada. Gere uma chave gratuita em https://aistudio.google.com/apikey e adicione no .env do projeto.";
    console.error(`[Gemini] ${message}`);
    throw new Error(message);
  }
  return apiKey;
}

function buildPrompt(input: ProductStoryInput): string {
  const { title, category, priceCents, originalPriceCents, variant } = input;

  const hasPrice = typeof priceCents === "number";
  const discount =
    hasPrice && originalPriceCents
      ? Math.round((1 - (priceCents as number) / originalPriceCents) * 100)
      : 0;

  const priceInfo = hasPrice
    ? discount > 0
      ? `O preço atual é ${formatBRL(priceCents as number)} (era ${formatBRL(originalPriceCents as number)}, ${discount}% de desconto).`
      : `O preço atual é ${formatBRL(priceCents as number)}.`
    : "O preço não foi informado — não invente preço nenhum e não cite valor na história.";

  return [
    "Você escreve posts de divulgação para grupos de Facebook no Brasil, no estilo “achadinhos”.",
    "Escreva UMA mini-história curta em português do Brasil, primeira pessoa, como uma pessoa",
    "comum contando pros amigos um produto que ela achou.",
    "",
    "Copie EXATAMENTE o formato, o ritmo e o tom deste exemplo (é o padrão obrigatório — mude",
    "só o conteúdo pro produto de agora):",
    "",
    "<exemplo>",
    "Gente, eu estava precisando de uma coisa pra deixar meus cílios mais bonitos sem precisar",
    "ficar indo toda hora fazer extensão 😅",
    "Foi aí que encontrei esse Kit de Extensão DIY para Cílios 40D, com vários tamanhos e 200",
    "unidades.",
    "Achei muito interessante porque dá pra fazer em casa e escolher o efeito que você quer, sem",
    "precisar comprar vários produtos separados.",
    "E o melhor: encontrei por um preço que eu realmente não esperava 👀🔥",
    "Pra quem também gosta de cílios mais destacados, vale a pena dar uma olhada!",
    "</exemplo>",
    "",
    "AGORA ESCREVA A MESMA COISA PARA ESTE PRODUTO:",
    `PRODUTO: "${title}"`,
    category ? `CATEGORIA: ${category}` : "",
    priceInfo,
    "",
    "AS 5 LINHAS, NESTA ORDEM (uma por linha, separadas por quebra de linha simples):",
    '1. "Gente, eu estava precisando de..." — a necessidade concreta que ESTE produto resolve,',
    "   contada como algo que aconteceu com você. 1 emoji leve no fim (😅 ou parecido).",
    '2. "Foi aí que encontrei esse " + nome do produto + 1 ou 2 características concretas que',
    "   aparecem no próprio título (quantidade, tamanho, modelo, material, cor, potência…).",
    '3. "Achei muito interessante porque " + o benefício prático, ligado à linha 1.',
    priceInfo.startsWith("O preço não")
      ? '4. "E o melhor: encontrei por um preço que eu realmente não esperava 👀🔥"'
      : '4. "E o melhor: encontrei por " + o preço informado acima + " 👀🔥"',
    '5. "Pra quem também..." — convida quem tem o mesmo problema a dar uma olhada. Termina com "!"',
    "",
    "PROIBIDO:",
    "- Começar com pergunta retórica (“quem mais aqui…”, “você também…”, “já passou por isso?”).",
    "  A linha 1 é SEMPRE um relato seu, no passado, começando com “Gente, eu estava…”.",
    "- Tom de anúncio/loja: “imperdível”, “corre”, “oferta relâmpago”, “transforme seu”,",
    "  “sonha com”, “efeito power”, CAPS LOCK, ponto de exclamação em toda linha.",
    "- Inventar característica que não dá pra deduzir do título, ou prometer resultado, prazo,",
    "  cura ou efeito de saúde. Nada de dizer que usou por semanas/meses — você só ENCONTROU.",
    "- Hashtag, link, título, negrito, bullet, aspas envolvendo o texto ou qualquer comentário",
    "  seu. Devolva SOMENTE as 5 linhas, prontas pra colar.",
    "- Passar de 4 emojis no texto todo.",
    variant && variant > 0
      ? `\nEsta é a variação nº ${variant + 1}: mantenha exatamente o mesmo formato das 5 linhas, mas mude a necessidade da linha 1 e o benefício da linha 3 pra um ângulo diferente do produto.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Limpa resíduos que o modelo às vezes devolve mesmo com a instrução (cercas de
// código, aspas envolvendo tudo, hashtags, ou um link que ele inventou).
function cleanStory(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "");
  text = text.replace(/^["“'](.*)["”']$/s, "$1");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !/^#\S/.test(line))
    .filter((line) => !/https?:\/\//i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Chamada base do modelo, compartilhada pelos geradores de texto.
// `minLines` = quantas linhas não vazias a resposta precisa ter pra ser
// considerada completa (proteção contra corte no meio).
async function callGemini(prompt: string, minLines: number): Promise<string> {
  const apiKey = requireApiKey();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // Baixa de propósito: o formato é rígido (copia o exemplo), a variação
        // tem que vir do conteúdo, não do modelo inventando estrutura e tom de
        // propaganda.
        temperature: 0.85,
        // O 2.5-flash vem com "thinking" ligado por padrão, e esses tokens de
        // raciocínio saem do mesmo orçamento da resposta — com o limite baixo o
        // texto vinha cortado na 1ª linha. Desligar o thinking (a tarefa é
        // simples) + orçamento folgado resolve.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1200,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Gemini texto] ${res.status} ${errText.slice(0, 500)}`);
    throw new Error(`Não foi possível gerar o texto agora (erro ${res.status}).`);
  }

  const json = (await res.json()) as GenerateContentResponse;
  const candidate = json.candidates?.[0];
  const raw = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const text = cleanStory(raw);

  if (!text) {
    console.error("[Gemini texto] resposta sem texto:", JSON.stringify(json).slice(0, 600));
    throw new Error("A IA não devolveu um texto no formato esperado.");
  }

  // Corta na metade (limite de tokens / filtro de segurança) → melhor cair no
  // fallback local do que entregar um texto pela metade pro usuário usar.
  const finish = candidate?.finishReason;
  const truncated =
    (finish && finish !== "STOP") || text.split("\n").filter(Boolean).length < minLines;
  if (truncated) {
    console.error(`[Gemini texto] texto incompleto (finishReason=${finish}):`, text);
    throw new Error("A IA devolveu um texto incompleto.");
  }

  return text;
}

export async function generateProductStory(input: ProductStoryInput): Promise<{ story: string }> {
  return { story: await callGemini(buildPrompt(input), 3) };
}

// ---------------------------------------------------------------------------
// Script falado do vídeo (aba IA → Cenas de Vídeo)
// ---------------------------------------------------------------------------

export type VideoScriptInput = {
  title: string;
  category?: string;
  // Cenário escolhido pra imagem, em texto ("na cozinha", "no banheiro"…) —
  // ajuda o script a combinar com o vídeo que a pessoa vai gravar.
  scenario?: string;
  variant?: number;
};

function buildVideoScriptPrompt(input: VideoScriptInput): string {
  const { title, category, scenario, variant } = input;

  return [
    "Você escreve a FALA de vídeos curtos de divulgação (TikTok/Reels), estilo “achadinhos”.",
    "É texto pra pessoa FALAR olhando pra câmera segurando o produto — não é legenda, não é post.",
    "",
    "Copie EXATAMENTE o tom, o tamanho e o ritmo deste exemplo (mude só o conteúdo):",
    "",
    "<exemplo>",
    "Gente, olha o que eu achei! Esse removedor de cutículas e essa lixa elétrica facilitam muito",
    "na hora de fazer as unhas. Eu tô apaixonada, sério!",
    "</exemplo>",
    "",
    "AGORA ESCREVA A FALA PARA ESTE PRODUTO:",
    `PRODUTO: "${title}"`,
    category ? `CATEGORIA: ${category}` : "",
    scenario ? `A pessoa está gravando: ${scenario}` : "",
    "",
    "REGRAS:",
    "- 3 frases curtas, no MÁXIMO. Dá pra falar em uns 12 segundos.",
    '- Frase 1: abertura de descoberta, tipo "Gente, olha o que eu achei!".',
    "- Frase 2: o que é e pra que serve, com 1 característica concreta que aparece no título",
    "  do produto. É aqui que a fala se conecta com ESTE produto e não com outro qualquer.",
    "- Frase 3: uma reação pessoal curta e empolgada, tipo “Eu tô apaixonada, sério!”.",
    "- Português do Brasil falado, natural, como se contasse pra uma amiga.",
    "- Tudo num parágrafo só, sem quebra de linha, sem emoji (é fala, não legenda).",
    "- PROIBIDO: hashtag, link, preço, “link na bio”, “corre”, “imperdível”, CAPS LOCK,",
    "  marcação de cena tipo “[mostra o produto]”, aspas envolvendo o texto, ou qualquer",
    "  comentário seu. Devolva SOMENTE a fala.",
    "- Não invente característica que não dá pra deduzir do título, nem prometa resultado,",
    "  prazo, cura ou efeito de saúde.",
    variant && variant > 0
      ? `\nEsta é a variação nº ${variant + 1}: mesma estrutura, mas mude o ângulo e as palavras.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateVideoScript(input: VideoScriptInput): Promise<{ script: string }> {
  // minLines 1: o script é um parágrafo único de propósito.
  return { script: await callGemini(buildVideoScriptPrompt(input), 1) };
}
