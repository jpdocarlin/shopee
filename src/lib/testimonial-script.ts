import type { DemoProduct } from "@/data/demo-products";
import { MARKETPLACE_META } from "@/data/demo-products";
import { formatBRL } from "@/lib/format";

const LINK_PLACEHOLDER = "[cole aqui o seu link de afiliado]";

type CategoryPhrases = {
  needs: string[];
  benefits: string[];
};

const CATEGORY_PHRASES: Record<string, CategoryPhrases> = {
  Beleza: {
    needs: [
      "estava precisando renovar minha rotina de skincare",
      "tava atrás de um produto de beleza que realmente funcionasse",
      "queria melhorar minha rotina de cuidados sem gastar uma fortuna",
    ],
    benefits: [
      "minha pele/cabelo agradeceu demais, o resultado apareceu rapidinho",
      "virou item fixo da minha rotina, uso todo dia",
      "o efeito foi muito melhor do que eu esperava pelo preço",
    ],
  },
  "Casa e Cozinha": {
    needs: [
      "estava precisando de um jeito mais prático de organizar as coisas em casa",
      "queria facilitar minha vida na cozinha",
      "tava cansada(o) de perder tempo com tarefa de casa que devia ser simples",
    ],
    benefits: [
      "economizei um tempo absurdo no dia a dia",
      "a casa ficou muito mais prática, nem lembro como vivia sem isso",
      "virou o item que eu mais uso na cozinha",
    ],
  },
  Eletrônicos: {
    needs: [
      "estava precisando de um gadget que realmente ajudasse na rotina",
      "queria upar meu setup sem gastar muito",
      "tava procurando substituir um eletrônico que já tinha dado defeito",
    ],
    benefits: [
      "a qualidade surpreendeu muito pelo preço que paguei",
      "facilitou demais meu dia a dia com tecnologia",
      "funciona muito bem, nem parece que custou tão pouco",
    ],
  },
  Escritório: {
    needs: [
      "precisava organizar melhor meu home office",
      "estava procurando deixar minha mesa de trabalho mais funcional",
      "queria um material de escritório que realmente valesse a pena",
    ],
    benefits: [
      "meu rendimento no trabalho melhorou só de ter isso na mesa",
      "ficou tudo mais organizado e prático",
      "foi um upgrade simples que fez diferença gigante no dia a dia",
    ],
  },
  Games: {
    needs: [
      "queria melhorar minha experiência jogando sem gastar muito",
      "estava precisando trocar um acessório de games que já tava ruim",
      "tava de olho em algo pra deixar meu setup gamer completo",
    ],
    benefits: [
      "a diferença na hora de jogar foi absurda",
      "virou item essencial do meu setup",
      "o custo-benefício surpreendeu, esperava bem menos por esse preço",
    ],
  },
  Moda: {
    needs: [
      "queria renovar o guarda-roupa sem gastar muito",
      "estava procurando uma peça coringa pra usar em tudo",
      "tava de olho em algo assim faz tempo, só esperando o preço cair",
    ],
    benefits: [
      "recebi um monte de elogio já na primeira vez que usei",
      "virou peça favorita do guarda-roupa",
      "o caimento e a qualidade surpreenderam muito pelo preço",
    ],
  },
  Saúde: {
    needs: [
      "queria cuidar melhor da minha saúde e bem-estar",
      "estava procurando algo pra me ajudar na rotina de cuidados",
      "tava precisando de um empurrão pra criar um hábito mais saudável",
    ],
    benefits: [
      "senti diferença já nas primeiras semanas usando",
      "virou parte da minha rotina, não abro mão mais",
      "me ajudou muito mais do que eu esperava pelo preço",
    ],
  },
};

const DEFAULT_PHRASES: CategoryPhrases = {
  needs: ["estava precisando de uma coisa assim há um tempo"],
  benefits: ["me ajudou muito mais do que eu esperava"],
};

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

export function generateTestimonialScript(product: DemoProduct, link?: string): string {
  const phrases = CATEGORY_PHRASES[product.category] ?? DEFAULT_PHRASES;
  const need = pick(phrases.needs);
  const benefit = pick(phrases.benefits);
  const marketplaceLabel = MARKETPLACE_META[product.marketplace].label;
  const price = formatBRL(product.priceCents);
  const finalLink = link?.trim() || LINK_PLACEHOLDER;

  return [
    `Fala pessoal! 👋`,
    `${need.charAt(0).toUpperCase() + need.slice(1)}, e decidi comprar ${product.title} na ${marketplaceLabel} pra testar.`,
    `Foi uma das melhores decisões que já tomei — ${benefit}.`,
    `Tá saindo por ${price} agora, então se você também tava precisando, corre que costuma acabar rápido:`,
    `👉 ${finalLink}`,
  ].join("\n");
}
