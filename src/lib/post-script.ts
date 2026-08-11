import { formatBRL } from "@/lib/format";

// "historia" é o padrão do post: uma mini-história em 1ª pessoa conectada ao
// produto, escrita pela IA (com o fallback local abaixo quando a IA falha).
// "emoji" e "direto" continuam como formatos curtos alternativos.
export type ScriptTone = "historia" | "emoji" | "direto";

// Produto do catálogo (DemoProduct) tem preço/nota/avaliações — atende essa
// forma automaticamente. Um link salvo pela extensão do Chrome a partir de
// QUALQUER produto real da Shopee não tem esses dados (só título/imagem), por
// isso todos os campos além do título são opcionais aqui.
export type PostScriptProduct = {
  title: string;
  priceCents?: number;
  originalPriceCents?: number | null;
  rating?: number;
  reviews?: number;
  category?: string;
};

const LINK_PLACEHOLDER = "[cole aqui o seu link de afiliado]";

function discountPct(product: PostScriptProduct): number {
  if (typeof product.priceCents !== "number" || !product.originalPriceCents) return 0;
  return Math.round((1 - product.priceCents / product.originalPriceCents) * 100);
}

// ---------------------------------------------------------------------------
// Fallback local da mini-história
// ---------------------------------------------------------------------------
// Usado quando a IA não responde (sem chave, cota estourada, rede fora). Não
// substitui a IA em qualidade — a graça da história vinda do modelo é ela citar
// características do título — mas garante que o usuário nunca fique sem post.
// A necessidade vem da categoria; quando o produto não tem categoria (link
// salvo pela extensão), cai num texto neutro que ainda cita o nome do produto.

type CategoryStory = {
  need: string;
  benefit: string;
};

const CATEGORY_STORIES: Record<string, CategoryStory> = {
  Beleza: {
    need: "eu estava querendo cuidar mais da minha beleza sem precisar gastar em salão toda semana",
    benefit: "dá pra fazer em casa, do jeito que você quiser, sem depender de ninguém",
  },
  "Casa e Cozinha": {
    need: "eu estava precisando de uma coisa pra deixar minha casa mais prática no dia a dia",
    benefit: "resolve uma daquelas tarefas chatas em bem menos tempo",
  },
  Eletrônicos: {
    need: "eu estava atrás de um eletrônico que ajudasse de verdade na rotina, sem pagar caro",
    benefit: "faz o que promete e ainda deixa o setup bem mais completo",
  },
  Escritório: {
    need: "eu estava precisando organizar melhor minha mesa de trabalho",
    benefit: "deixa tudo mais organizado e o dia rende bem mais",
  },
  Games: {
    need: "eu estava querendo melhorar meu setup de games sem estourar o orçamento",
    benefit: "faz diferença de verdade na hora de jogar",
  },
  Moda: {
    need: "eu estava querendo renovar o guarda-roupa sem gastar muito",
    benefit: "é aquela peça coringa que combina com quase tudo",
  },
  Saúde: {
    need: "eu estava querendo cuidar melhor de mim na correria do dia a dia",
    benefit: "encaixa fácil na rotina, sem complicação",
  },
};

const DEFAULT_STORY: CategoryStory = {
  need: "eu estava precisando de uma coisa assim fazia um tempo",
  benefit: "resolve bem o que eu precisava, sem complicação",
};

export function buildFallbackStory(product: PostScriptProduct): string {
  const story = (product.category && CATEGORY_STORIES[product.category]) || DEFAULT_STORY;
  const hasPrice = typeof product.priceCents === "number";
  const discount = discountPct(product);

  const priceLine = hasPrice
    ? discount > 0
      ? `E o melhor: encontrei com ${discount}% off, saindo por ${formatBRL(product.priceCents as number)} 👀🔥`
      : `E o melhor: encontrei por ${formatBRL(product.priceCents as number)}, um preço que eu não esperava 👀🔥`
    : "E o melhor: encontrei por um preço que eu realmente não esperava 👀🔥";

  return [
    `Gente, ${story.need} 😅`,
    `Foi aí que encontrei esse ${product.title}.`,
    `Achei muito interessante porque ${story.benefit}.`,
    priceLine,
    "Pra quem também tava precisando, vale a pena dar uma olhada!",
  ].join("\n");
}

// Monta o post final: história (da IA ou do fallback) + link no fim.
export function buildStoryPost(story: string, link?: string): string {
  const finalLink = link?.trim() || LINK_PLACEHOLDER;
  return `${story.trim()}\n\n${finalLink}`;
}

// ---------------------------------------------------------------------------
// Formatos curtos (alternativas ao post de história)
// ---------------------------------------------------------------------------

export function generatePostScript(
  product: PostScriptProduct,
  options: { link?: string; tone?: ScriptTone } = {},
): string {
  const { link, tone = "historia" } = options;
  const hasPrice = typeof product.priceCents === "number";
  const price = hasPrice ? formatBRL(product.priceCents as number) : undefined;
  const discount = discountPct(product);
  const finalLink = link?.trim() || LINK_PLACEHOLDER;
  const hasRating = typeof product.rating === "number" && typeof product.reviews === "number";

  if (tone === "historia") {
    return buildStoryPost(buildFallbackStory(product), link);
  }

  if (tone === "direto") {
    const priceLine = hasPrice
      ? discount > 0
        ? `De ${formatBRL(product.originalPriceCents ?? 0)} por ${price} (${discount}% off).`
        : `Por ${price}.`
      : null;
    const lines = [product.title, priceLine, `Link: ${finalLink}`].filter(
      (l): l is string => l !== null,
    );
    return lines.join("\n");
  }

  const priceLine = hasPrice
    ? discount > 0
      ? `De ~${formatBRL(product.originalPriceCents ?? 0)}~ por apenas ${price} (${discount}% OFF) 😱`
      : `Por apenas ${price} 👀`
    : null;
  const ratingLine = hasRating
    ? `⭐ ${(product.rating as number).toFixed(1)} · +${(product.reviews as number).toLocaleString("pt-BR")} avaliações`
    : null;

  const lines = [
    `🔥 ${product.title}`,
    priceLine,
    ratingLine,
    "",
    "Corre que costuma acabar rápido 🏃‍♀️",
    `👉 ${finalLink}`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
