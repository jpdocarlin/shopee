// Gera a legenda pronta pra colar na hora de postar no TikTok — hook curto +
// chamada pra ação + hashtags relevantes. Fecha a última etapa manual do
// fluxo de conteúdo (foto/cena + script já existiam; faltava a legenda).
import type { DemoProduct } from "@/data/demo-products";

const GENERIC_HASHTAGS = ["#achadinhos", "#achadosdodia", "#tiktokshop", "#promocao"];

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  Beleza: ["#achadinhosdebeleza", "#skincare", "#beleza"],
  "Casa e Cozinha": ["#achadinhoscasa", "#organizacao", "#cozinha"],
  Eletrônicos: ["#achadinhostech", "#gadgets", "#tecnologia"],
  Escritório: ["#homeoffice", "#organizacao", "#produtividade"],
  Games: ["#achadinhosgamer", "#setupgamer", "#gamer"],
  Moda: ["#achadinhosmoda", "#moda", "#outfit"],
  Saúde: ["#achadinhossaude", "#bemestar", "#autocuidado"],
};

const HOOKS = [
  "gente, achei isso e precisava mostrar pra vocês 👀",
  "esse foi o achadinho que mais usei esse mês",
  "vim contar sobre esse achado antes que acabe",
  "achei isso e já tô craque de tanto usar",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

export function generateTikTokCaption(product: DemoProduct): string {
  const hook = pick(HOOKS);
  const categoryTags = CATEGORY_HASHTAGS[product.category] ?? [];
  const hashtags = [...categoryTags, ...GENERIC_HASHTAGS].join(" ");

  return [`${product.title} — ${hook}`, `Link nos comentários/bio 🔗`, hashtags].join("\n");
}
