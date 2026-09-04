// Server-only client do Gemini para geração de TEXTO (mini-história do post).
// SECURITY: só pode ser importado dentro de handlers de server function (via
// import dinâmico) — nunca no topo de uma rota ou de um *.functions.ts, que
// vão pro bundle do cliente. Mesma regra do gemini-image.server.ts.
import { formatBRL } from "@/lib/format";

// 04/09/2026: gemini-2.5-flash parou de aceitar chamadas ("no longer
// available to new users" — a Google migrou as chaves de API pra um novo
// esquema de "auth keys" em set/2026 e junto empurrou os projetos mais novos
// pra modelos mais recentes). Erro confirmado ao vivo: "erro 404" na geração
// de título/descrição do Criar Anúncio. Trocado pro modelo que a própria
// resposta de erro do Google recomendou pra esta chave.
const MODEL = "gemini-3.6-flash";
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
async function callGemini(
  prompt: string,
  minLines: number,
  clean: (raw: string) => string = cleanStory,
): Promise<string> {
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
        // 04/09/2026: migrado de gemini-2.5-flash pra gemini-3.6-flash (o
        // 2.5 parou de aceitar chamadas — ver comentário no MODEL acima).
        // Nos modelos Gemini 3, `temperature` solto e `thinkingConfig.
        // thinkingBudget` (número) não são mais aceitos e a API devolve 400 —
        // confirmado ao vivo. O equivalente novo é `thinkingConfig.
        // thinkingLevel` (string: "low"/"medium"/"high"). Usa "low" porque a
        // tarefa é simples e rígida em formato — não precisa de raciocínio.
        thinkingConfig: { thinkingLevel: "low" },
        // 04/09/2026: nos modelos Gemini 3 não dá pra desligar o "thinking"
        // de vez (thinkingBudget: 0 não existe mais, só thinkingLevel low/
        // medium/high) — mesmo em "low" ele gasta uma parte do orçamento de
        // saída antes de responder. Com 1200 (valor herdado do 2.5-flash,
        // que conseguia zerar o thinking) a resposta vinha cortada no meio
        // ("A IA devolveu um texto incompleto", confirmado ao vivo). Subiu
        // pra sobrar espaço pro raciocínio + o texto de verdade.
        maxOutputTokens: 3000,
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
  const text = clean(raw);

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

// ---------------------------------------------------------------------------
// Anúncio de lojista (revenda / dropshipping)
// ---------------------------------------------------------------------------

export type ListingInput = {
  productTitle: string;
  category?: string;
  marketplace: "shopee" | "mercado-livre";
  variant?: number;
};

export type ListingResult = {
  title: string;
  description: string;
  keywords: string[];
};

/** Limite de caracteres do título em cada marketplace. */
const TITLE_LIMIT: Record<ListingInput["marketplace"], number> = {
  shopee: 120,
  "mercado-livre": 60,
};

function buildListingPrompt(input: ListingInput): string {
  const { productTitle, category, marketplace, variant } = input;
  const limit = TITLE_LIMIT[marketplace];
  const marketplaceLabel = marketplace === "shopee" ? "Shopee" : "Mercado Livre";

  return [
    `Você cria anúncios de vendedor na ${marketplaceLabel} no Brasil. Escreva o anúncio de um`,
    "vendedor que vai revender este produto na própria loja.",
    "",
    `PRODUTO DE ORIGEM: "${productTitle}"`,
    category ? `CATEGORIA: ${category}` : "",
    "",
    "Devolva EXATAMENTE neste formato, com estes rótulos, e nada além disso:",
    "",
    "TITULO: <uma linha>",
    "DESCRICAO:",
    "<várias linhas>",
    "PALAVRAS-CHAVE: <termo1, termo2, termo3, ...>",
    "",
    "REGRAS DO TÍTULO:",
    `- No MÁXIMO ${limit} caracteres. Conte os caracteres, é limite da plataforma.`,
    "- Começa pelo nome do produto (o termo que a pessoa digita na busca), depois características",
    "  que ajudam a achar: tipo, quantidade, tamanho, material, cor, modelo, compatibilidade.",
    "- Sem CAPS LOCK, sem emoji, sem “frete grátis”, sem “promoção”, sem “imperdível”, sem preço,",
    "  sem nome de loja, sem caractere especial tipo estrela ou check.",
    "- Não repita a mesma palavra várias vezes só pra encher.",
    "",
    "REGRAS DA DESCRIÇÃO:",
    "- Em português do Brasil, fácil de escanear, entre 120 e 220 palavras.",
    "- Comece com 2 linhas dizendo o que é e pra que serve, em linguagem simples.",
    '- Depois uma seção "Por que comprar:" com 4 a 5 bullets começando com "- ", cada bullet',
    "  ligando uma característica a um benefício prático.",
    '- Depois "Especificações:" com os dados que dá pra deduzir do título de origem',
    "  (tamanho, quantidade, material, voltagem, compatibilidade). Se um dado não aparece no",
    '  título, escreva "conforme a foto do anúncio" em vez de inventar número.',
    '- Depois "O que vem na embalagem:" listando o conteúdo, se der pra deduzir.',
    "- Termine com 1 linha convidando a comprar, sem exagero.",
    "",
    "REGRAS DAS PALAVRAS-CHAVE:",
    "- 8 a 12 termos de busca separados por vírgula, tudo minúsculo, do mais buscado pro menos.",
    "- Incluir sinônimos e como a pessoa comum escreve (inclusive sem acento).",
    "",
    "PROIBIDO EM TODO O ANÚNCIO:",
    "- Inventar marca, garantia, certificação, laudo, prazo de entrega ou origem que não estejam",
    "  no título de origem.",
    "- Prometer resultado de saúde, cura, emagrecimento ou efeito terapêutico.",
    "- Citar preço, link, cupom, WhatsApp, rede social ou contato fora da plataforma.",
    variant && variant > 0
      ? `\nEsta é a variação nº ${variant + 1}: mesmo formato, mas mude o ângulo do título e os bullets.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// A limpeza da história come linhas demais (hashtag, link) e aqui o texto é
// estruturado — então o anúncio usa uma limpeza mínima, só pra tirar cerca de
// código e negrito de markdown.
function cleanListing(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .replace(/\*\*/g, "")
    .trim();
}

export async function generateListing(input: ListingInput): Promise<ListingResult> {
  const text = await callGemini(buildListingPrompt(input), 4, cleanListing);

  const titleMatch = text.match(/TITULO:\s*(.+)/i);
  const keywordsMatch = text.match(/PALAVRAS-CHAVE:\s*(.+)/i);
  const descriptionMatch = text.match(/DESCRICAO:\s*([\s\S]*?)(?=\nPALAVRAS-CHAVE:|$)/i);

  const limit = TITLE_LIMIT[input.marketplace];
  const title = (titleMatch?.[1] ?? "").trim().slice(0, limit);
  const description = (descriptionMatch?.[1] ?? "").trim();
  const keywords = (keywordsMatch?.[1] ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  if (!title || !description) {
    console.error("[Gemini anúncio] resposta fora do formato:", text.slice(0, 600));
    throw new Error("A IA não devolveu o anúncio no formato esperado.");
  }

  return { title, description, keywords };
}
