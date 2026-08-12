// Server-only client for Gemini's Nano Banana (image generation).
// SECURITY: Only use this from other .server.ts modules or via dynamic import
// inside a server function handler — never import it at the top level of a
// route file or a *.functions.ts module (those ship to the client bundle).
// Load inside server handlers: const { generateProductPhoto } = await import("@/lib/gemini-image.server");
import { getScenarioPrompt, getShotType, getShotTypePrompt } from "@/data/video-scenes";

type GenerateImageResult = {
  dataUrl: string;
};

// Nano Banana (gemini-2.5-flash-image) — o único modelo de imagem do Gemini
// com tier gratuito de verdade (~500 gerações/dia, sem cartão). O Nano Banana 2
// (gemini-3.1-flash-image) exige faturamento ativado desde dez/2025 (0 free tier).
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

type ContentPart = {
  type?: string;
  text?: string;
  mime_type?: string;
  mimeType?: string;
  data?: string;
};

type InteractionsResponse = {
  // Formato de conveniência citado na doc (SDK) — mantido como fallback.
  output_image?: { data?: string; mime_type?: string; mimeType?: string };
  outputImage?: { data?: string; mime_type?: string; mimeType?: string };
  // Formato real observado na resposta REST: lista ordenada de steps, cada um
  // com um array de content parts (texto e/ou imagem).
  steps?: Array<{ type?: string; content?: ContentPart[] }>;
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

// Baixa a foto real do produto (a mesma imagem exibida no catálogo) e converte
// pra base64, pra mandar como referência visual pro Gemini — assim o modelo
// usa o produto de verdade em vez de inventar um a partir só do texto.
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[Gemini] falha ao baixar imagem de referência (${res.status}): ${url}`);
      return null;
    }
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    return { data, mimeType };
  } catch (err) {
    console.error("[Gemini] erro ao baixar imagem de referência:", err);
    return null;
  }
}

async function callInteractionsApi(
  prompt: string,
  aspectRatio: string,
  referenceImage?: { data: string; mimeType: string } | null,
): Promise<GenerateImageResult> {
  const apiKey = requireApiKey();

  const input: ContentPart[] = referenceImage
    ? [
        { type: "image", mime_type: referenceImage.mimeType, data: referenceImage.data },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: aspectRatio,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Gemini] ${res.status} ${errText.slice(0, 500)}`);
    throw new Error(
      `Não foi possível gerar a imagem agora (erro ${res.status}): ${errText.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as InteractionsResponse;

  let data: string | undefined;
  let mimeType = "image/jpeg";

  const directOutput = json.output_image ?? json.outputImage;
  if (directOutput?.data) {
    data = directOutput.data;
    mimeType = directOutput.mime_type ?? directOutput.mimeType ?? mimeType;
  } else {
    outer: for (const step of json.steps ?? []) {
      for (const part of step.content ?? []) {
        if (part.data) {
          data = part.data;
          mimeType = part.mime_type ?? part.mimeType ?? mimeType;
          break outer;
        }
      }
    }
  }

  if (!data) {
    const raw = JSON.stringify(json).slice(0, 800);
    console.error("[Gemini] resposta sem imagem reconhecível:", raw);
    throw new Error(`A Gemini API não retornou uma imagem no formato esperado: ${raw}`);
  }

  return { dataUrl: `data:${mimeType};base64,${data}` };
}

export async function generateProductPhoto({
  title,
  category,
}: {
  title: string;
  category: string;
}): Promise<GenerateImageResult> {
  const prompt = [
    "Fotografia de produto profissional para e-commerce, estilo catálogo.",
    `Produto: "${title}" (categoria: ${category}).`,
    "Fundo neutro liso e desfocado, iluminação de estúdio suave, produto centralizado e em foco,",
    "super realista, sem texto, sem marca d'água, sem pessoas.",
  ].join(" ");

  return callInteractionsApi(prompt, "1:1");
}

// Refaz a foto original do produto (geralmente comprimida/mal iluminada, como
// vem do catálogo do marketplace) numa versão de qualidade profissional de
// catálogo, mantendo o produto idêntico — usado no post pronto pro Facebook.
export async function generateEnhancedProductPhoto({
  title,
  category,
  productImageUrl,
}: {
  title: string;
  category?: string;
  productImageUrl: string;
}): Promise<GenerateImageResult> {
  const referenceImage = await fetchImageAsBase64(productImageUrl);

  const productInstruction = referenceImage
    ? [
        "Use exatamente o produto mostrado na imagem de referência anexada — mesma cor, formato,",
        "material, rótulo, textura e proporções. Não redesenhe, não substitua, não estilize e não",
        "adicione nada ao produto (sem acessórios extras, sem itens novos, sem alterar o design):",
        "ele deve ficar idêntico à foto de referência, só que fotografado com qualidade profissional.",
      ].join(" ")
    : `Produto: "${title}"${category ? ` (categoria: ${category})` : ""}.`;

  const prompt = [
    "Refaça esta foto de produto de e-commerce com qualidade de catálogo profissional, altíssima",
    "resolução e nitidez.",
    productInstruction,
    "Fundo neutro liso (branco ou cinza bem claro) e levemente desfocado, iluminação de estúdio",
    "suave e uniforme, produto perfeitamente centralizado e em foco total, sem ruído, sem",
    "pixelização, sem artefato de compressão, sem texto, sem marca d'água, sem pessoas, sem",
    "sombras duras.",
  ].join(" ");

  return callInteractionsApi(prompt, "1:1", referenceImage);
}

export async function generateVideoScenePhoto({
  title,
  category,
  productImageUrl,
  scenarioId,
  customScenario,
  genderId,
  shotTypeId,
}: {
  title: string;
  category: string;
  productImageUrl: string;
  scenarioId: string;
  customScenario?: string;
  genderId: string;
  shotTypeId: string;
}): Promise<GenerateImageResult> {
  const shot = getShotTypePrompt(shotTypeId, genderId);
  const shotNegative = getShotType(shotTypeId).negative;
  const scenario = getScenarioPrompt(scenarioId, customScenario);
  const referenceImage = await fetchImageAsBase64(productImageUrl);

  const productInstruction = referenceImage
    ? [
        "Use exatamente o produto mostrado na imagem de referência anexada — mesma cor, formato,",
        "material, rótulo e embalagem. Não redesenhe, não substitua, não estilize e não adicione",
        "nada ao produto (sem acessórios extras, sem itens novos, sem alterar o design): ele deve",
        "aparecer idêntico à foto de referência, só que agora sendo segurado com naturalidade na mão",
        "do personagem dentro da cena descrita abaixo.",
      ].join(" ")
    : `Produto: "${title}" (categoria: ${category}).`;

  const prompt = [
    "Still de referência fotorrealista pra gravação de vídeo de rede social (estilo achadinhos/UGC), formato vertical.",
    productInstruction,
    `ENQUADRAMENTO (siga à risca): ${shot}.`,
    `NÃO PODE APARECER: ${shotNegative}.`,
    `Cenário: ${scenario}.`,
    "Super realista, iluminação natural, sem texto sobreposto na imagem, sem marca d'água,",
    "parece still real de vídeo autêntico e não foto de estúdio posada.",
  ].join(" ");

  return callInteractionsApi(prompt, "9:16", referenceImage);
}
