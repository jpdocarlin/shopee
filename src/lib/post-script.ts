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
  needs: string[];
  benefits: string[];
};

const CATEGORY_STORIES: Record<string, CategoryStory> = {
  Beleza: {
    needs: [
      "eu estava querendo cuidar mais da minha beleza sem precisar gastar em salão toda semana",
      "eu estava cansada de depender de horário de salão pra ficar do jeito que eu gosto",
      "eu estava procurando uma coisa de beleza que valesse o que custa, sem enrolação",
    ],
    benefits: [
      "dá pra fazer em casa, do seu jeito, sem depender de ninguém",
      "resolve tudo num item só, em vez de comprar várias coisas separadas",
      "é bem simples de usar, mesmo pra quem nunca mexeu com isso",
    ],
  },
  "Casa e Cozinha": {
    needs: [
      "eu estava precisando de uma coisa pra deixar minha casa mais prática no dia a dia",
      "eu estava perdendo um tempo absurdo numa tarefa de casa que devia ser simples",
      "eu estava querendo organizar melhor a bagunça aqui de casa sem gastar muito",
    ],
    benefits: [
      "resolve uma daquelas tarefas chatas em bem menos tempo",
      "é daquelas coisas que você usa todo dia sem nem perceber",
      "ocupa pouco espaço e já deixa tudo muito mais organizado",
    ],
  },
  Eletrônicos: {
    needs: [
      "eu estava atrás de um eletrônico que ajudasse de verdade na rotina, sem pagar caro",
      "eu estava precisando substituir um que já tinha dado defeito",
      "eu estava querendo dar uma melhorada no meu setup sem gastar uma fortuna",
    ],
    benefits: [
      "faz o que promete e ainda deixa o setup bem mais completo",
      "é fácil de instalar, você tira da caixa e já usa",
      "a qualidade é bem melhor do que eu esperava pelo preço",
    ],
  },
  Escritório: {
    needs: [
      "eu estava precisando organizar melhor minha mesa de trabalho",
      "eu estava querendo deixar meu home office mais confortável pra passar o dia",
      "eu estava atrás de um material de escritório que durasse de verdade",
    ],
    benefits: [
      "deixa tudo mais organizado e o dia rende bem mais",
      "é uma mudança simples que faz diferença grande no dia a dia",
      "resolve bem e ainda economiza espaço na mesa",
    ],
  },
  Games: {
    needs: [
      "eu estava querendo melhorar meu setup de games sem estourar o orçamento",
      "eu estava precisando trocar um acessório que já estava bem gasto",
      "eu estava atrás de algo pra deixar as partidas mais confortáveis",
    ],
    benefits: [
      "faz diferença de verdade na hora de jogar",
      "virou item fixo do meu setup, não jogo mais sem",
      "o custo-benefício surpreende, esperava bem menos por esse preço",
    ],
  },
  Moda: {
    needs: [
      "eu estava querendo renovar o guarda-roupa sem gastar muito",
      "eu estava atrás de uma peça coringa pra usar em várias ocasiões",
      "eu estava de olho numa coisa assim faz tempo, só esperando o preço cair",
    ],
    benefits: [
      "é aquela peça coringa que combina com quase tudo",
      "o caimento e o acabamento surpreendem pelo preço",
      "dá pra usar tanto no dia a dia quanto pra sair",
    ],
  },
  Saúde: {
    needs: [
      "eu estava querendo cuidar melhor de mim na correria do dia a dia",
      "eu estava precisando de um empurrão pra manter uma rotina mais saudável",
      "eu estava atrás de algo simples pra encaixar no meu dia sem complicar",
    ],
    benefits: [
      "encaixa fácil na rotina, sem complicação",
      "é prático de usar e dá pra levar pra qualquer lugar",
      "ajuda a manter o hábito sem precisar de esforço nenhum",
    ],
  },
};

const DEFAULT_STORY: CategoryStory = {
  needs: [
    "eu estava precisando de uma coisa assim fazia um tempo",
    "eu estava atrás de algo prático pra resolver isso de vez",
    "eu estava querendo uma solução simples pra esse problema",
  ],
  benefits: [
    "resolve bem o que eu precisava, sem complicação",
    "é bem mais prático do que o que eu usava antes",
    "faz o que promete e não tem segredo pra usar",
  ],
};

// Escolhe a variação a partir do título do produto: produtos diferentes da
// mesma categoria ganham aberturas diferentes, mas o MESMO produto sempre gera
// o mesmo texto (não muda sozinho toda vez que o modal abre).
function pickByTitle<T>(list: T[], title: string, offset = 0): T {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return list[(hash + offset) % list.length] as T;
}

export function buildFallbackStory(product: PostScriptProduct): string {
  const variants = (product.category && CATEGORY_STORIES[product.category]) || DEFAULT_STORY;
  const story = {
    need: pickByTitle(variants.needs, product.title),
    // offset 1 pra necessidade e benefício não caírem sempre no mesmo par
    benefit: pickByTitle(variants.benefits, product.title, 1),
  };
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
