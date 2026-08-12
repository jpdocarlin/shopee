// Fallback local da fala do vídeo (aba IA → Cenas de Vídeo).
// Mesma ideia do post-script.ts: se a IA não responder, o usuário ainda recebe
// um script no formato certo, citando o produto que ele escolheu.

type CategoryLine = {
  // O que o produto faz — entra na 2ª frase, depois do nome do produto.
  useCase: string;
  // Reação pessoal da 3ª frase.
  reaction: string;
};

const CATEGORY_LINES: Record<string, CategoryLine[]> = {
  Beleza: [
    { useCase: "facilita muito na hora de se arrumar", reaction: "Eu tô apaixonada, sério!" },
    { useCase: "dá pra usar em casa sem precisar de salão", reaction: "Virou meu queridinho!" },
    { useCase: "deixa tudo bem mais fácil no dia a dia", reaction: "Tô amando o resultado!" },
  ],
  "Casa e Cozinha": [
    { useCase: "facilita demais aqui em casa", reaction: "Não vivo mais sem, sério!" },
    { useCase: "resolve numa boa aquela tarefa chata", reaction: "Eu tô apaixonada, sério!" },
    { useCase: "deixa tudo muito mais organizado", reaction: "Melhor coisa que eu comprei!" },
  ],
  Eletrônicos: [
    { useCase: "ajuda demais no dia a dia", reaction: "Tô impressionado, sério!" },
    { useCase: "é simples de usar, você tira da caixa e já vai", reaction: "Recomendo demais!" },
    { useCase: "deixou meu setup completo", reaction: "Não largo mais, sério!" },
  ],
  Escritório: [
    { useCase: "deixa a mesa bem mais organizada", reaction: "Faz uma diferença enorme!" },
    { useCase: "ajuda muito a render mais no trabalho", reaction: "Tô amando, sério!" },
    { useCase: "resolve e ainda economiza espaço", reaction: "Recomendo demais!" },
  ],
  Games: [
    { useCase: "faz muita diferença na hora de jogar", reaction: "Tô viciado, sério!" },
    { useCase: "deixou meu setup completo", reaction: "Melhor upgrade que eu fiz!" },
    { useCase: "é bem mais confortável nas partidas longas", reaction: "Não jogo mais sem!" },
  ],
  Moda: [
    { useCase: "combina com quase tudo", reaction: "Eu tô apaixonada, sério!" },
    { useCase: "dá pra usar no dia a dia e pra sair", reaction: "Virou minha peça favorita!" },
    { useCase: "o caimento ficou muito melhor do que eu esperava", reaction: "Tô amando!" },
  ],
  Saúde: [
    { useCase: "encaixa fácil na minha rotina", reaction: "Tô adorando, sério!" },
    { useCase: "é bem prático de levar pra qualquer lugar", reaction: "Recomendo demais!" },
    { useCase: "ajuda muito a manter o hábito", reaction: "Não largo mais!" },
  ],
};

const DEFAULT_LINES: CategoryLine[] = [
  { useCase: "facilita muito o dia a dia", reaction: "Eu tô apaixonada, sério!" },
  { useCase: "resolve direitinho o que eu precisava", reaction: "Tô amando, sério!" },
  { useCase: "é bem mais prático do que eu imaginava", reaction: "Recomendo demais!" },
];

// Mesma variação estável do post: produtos diferentes ganham falas diferentes,
// mas o mesmo produto sempre gera a mesma fala.
function pickByTitle<T>(list: T[], title: string): T {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return list[hash % list.length] as T;
}

// O título completo da Shopee é gigante e cheio de palavra-chave — falado em
// vídeo fica horrível. Corta nas primeiras palavras, no fim de uma palavra.
export function shortProductName(title: string, maxWords = 6): string {
  const words = title.trim().split(/\s+/);
  if (words.length <= maxWords) return title.trim();
  return words.slice(0, maxWords).join(" ");
}

export function buildFallbackVideoScript(product: { title: string; category?: string }): string {
  const line = pickByTitle(
    (product.category && CATEGORY_LINES[product.category]) || DEFAULT_LINES,
    product.title,
  );
  return `Gente, olha o que eu achei! Esse ${shortProductName(product.title)} ${line.useCase}. ${line.reaction}`;
}
