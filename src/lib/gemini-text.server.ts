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
    "Você escreve posts de divulgação de produto para grupos de Facebook no Brasil, no estilo",
    '"achadinhos". Escreva UMA mini-história curta, em português do Brasil, primeira pessoa,',
    "tom de conversa espontânea entre amigos — como uma pessoa comum contando um achado, não",
    "como propaganda de loja.",
    "",
    `PRODUTO: "${title}"`,
    category ? `CATEGORIA: ${category}` : "",
    priceInfo,
    "",
    "ESTRUTURA OBRIGATÓRIA (5 a 6 linhas curtas, uma por parágrafo, separadas por quebra de linha):",
    "1. Abertura com uma necessidade/incômodo REAL e específico que ESTE produto resolve.",
    "   Comece com algo como “Gente,” / “Pessoal,” e conte a situação em 1 frase.",
    "2. “Foi aí que encontrei” + o nome do produto, citando 1 ou 2 características concretas que",
    "   aparecem no próprio título (tamanho, quantidade, material, modelo, cor, potência etc.).",
    "3. Por que achou interessante — o benefício prático, ligado à necessidade da linha 1.",
    "4. Uma linha sobre o preço ter surpreendido (só se o preço foi informado acima).",
    "5. Fechamento convidando quem tem o mesmo problema a dar uma olhada.",
    "",
    "REGRAS:",
    "- A história TEM que ter conexão direta com este produto específico. Nada genérico que",
    "  serviria pra qualquer produto.",
    "- Use no máximo 4 emojis no texto todo, espalhados de forma natural.",
    '- Use "encontrei"/"achei" em vez de afirmar que usou por meses — não invente resultado,',
    "  prazo, testes, laudo, nem promessa de cura ou de saúde.",
    "- Não invente característica que não dá pra deduzir do título do produto.",
    "- Não escreva hashtags, não escreva título, não escreva nenhum link e não escreva nenhuma",
    "  observação sua: devolva SOMENTE o texto da história, pronto pra colar.",
    variant && variant > 0
      ? `- Esta é a variação nº ${variant + 1}: escreva uma história com abertura e ângulo diferentes das anteriores.`
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

export async function generateProductStory(input: ProductStoryInput): Promise<{ story: string }> {
  const apiKey = requireApiKey();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(input) }] }],
      generationConfig: {
        // Alto o suficiente pra cada clique em "Regenerar" dar uma história
        // diferente, sem viajar e inventar característica do produto.
        temperature: 1.1,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Gemini texto] ${res.status} ${errText.slice(0, 500)}`);
    throw new Error(`Não foi possível gerar a história agora (erro ${res.status}).`);
  }

  const json = (await res.json()) as GenerateContentResponse;
  const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const story = cleanStory(raw);

  if (!story) {
    console.error("[Gemini texto] resposta sem texto:", JSON.stringify(json).slice(0, 600));
    throw new Error("A IA não devolveu uma história no formato esperado.");
  }

  return { story };
}
