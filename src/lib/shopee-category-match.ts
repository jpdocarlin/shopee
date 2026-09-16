// Escolhe automaticamente a categoria certa da Shopee pra um produto, sem
// depender de o usuário escolher manualmente — foi exatamente escolher a
// categoria errada (ou o app deixar uma única categoria fixa pré-selecionada
// pra todo produto) que estava gerando violação de anúncio pra muita gente.
//
// Como funciona: em vez de mapear cada um dos ~27 nichos do catálogo C7Drop
// pra um category_id fixo (frágil — a árvore de categorias da Shopee muda,
// e nichos como "Produtos diversos" ou "Mais vendidos" nem são um tipo de
// produto de verdade), a gente casa por palavra-chave contra o CAMINHO
// completo de cada categoria-folha (ex.: "Casa e Decoração / Ferramentas /
// Furadeiras"), usando o título do produto (mais específico) reforçado por
// um pequeno dicionário de sinônimos por nicho (pra nichos onde a palavra do
// catálogo não é igual ao termo que a Shopee usa).

export type ShopeeCategoryOption = { id: number; name: string; path: string };

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "com", "para", "pra", "em", "no", "na",
  "nos", "nas", "um", "uma", "uns", "umas", "o", "a", "os", "as", "por", "sem",
  "mais", "menos", "ate", "ou", "que", "se", "ao", "aos", "the", "and", "for",
  "com", "novo", "nova", "kit", "unidade", "unidades", "cor", "cores",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

// Termos extras por nicho do catálogo C7Drop pra reforçar o casamento — só
// entram nichos onde vale a pena (nichos que já são "curadoria" tipo
// "Produtos diversos", "Mais vendidos", "Promoções do Mês", "Outros" e
// "Copa do Mundo" ficam de fora de propósito: não são um tipo de produto,
// então usar só o título do produto dá resultado mais confiável do que
// forçar um sinônimo genérico.
const NICHE_HINTS: Record<string, string> = {
  "Casa e Utensílios Domésticos": "casa utensilios domesticos cozinha organizador organizacao limpeza utilidades lar decoracao",
  Brinquedos: "brinquedo brinquedos infantil crianca boneca pelucia bebe",
  Informática: "informatica computador notebook pc periferico teclado mouse acessorios de informatica",
  Ferramentas: "ferramenta ferramentas furadeira parafusadeira chave bricolagem oficina construcao",
  "Beleza e Cuidado Pessoal": "beleza cuidado pessoal cosmetico skincare cabelo pele higiene",
  Câmeras: "camera cameras fotografia filmadora seguranca vigilancia",
  Iluminação: "iluminacao luminaria lampada luz led",
  "Caixas de Som": "caixa de som alto falante speaker audio bluetooth",
  "Relogios e Smartwatchs": "relogio relogios smartwatch pulseira inteligente",
  Papelaria: "papelaria caderno caneta escolar escritorio",
  "Salão & Barbearia": "salao barbearia cabelo barba maquina de corte secador",
  "Fones de Ouvido": "fone fones ouvido headset fone de ouvido",
  "Carregadores & Power Banks": "carregador power bank bateria portatil cabo usb",
  "Umidificadores & Ventiladores": "umidificador ventilador climatizador ar",
  "Media Streaming": "streaming tv box smart tv",
  "Materiais de Pesca": "pesca vara anzol carretilha molinete isca",
  "Ring Light & Suportes": "ring light suporte tripe iluminacao para celular",
  "Celulares e Smartphones": "celular smartphone capinha capa pelicula acessorios de celular",
  Games: "game games jogo controle console video game",
  "Garrafas, Copos e Canecas": "garrafa copo caneca squeeze termica",
  Maquiagem: "maquiagem batom base sombra pincel cosmetico",
  "Embalagens e Etiquetas": "embalagem etiqueta caixa envelope adesivo",
};

// Nichos que são curadoria/coleção, não um tipo de produto — pra esses o
// hint de nicho não ajuda (e pode até atrapalhar), então usa só o título.
const CURATION_NICHES = new Set([
  "Produtos diversos",
  "Mais vendidos",
  "Promoções do Mês",
  "Outros",
  "Copa do Mundo",
]);

// Escolhe a categoria-folha da Shopee com mais palavras em comum com o
// produto. Palavras vindas do TÍTULO valem o dobro de palavras vindas do
// nicho (o título descreve o produto de verdade; o nicho é só uma pista).
// Se nada bater (score 0 em toda a lista), devolve null — quem chama decide
// o fallback.
export function pickBestCategory(
  product: { title: string; category: string },
  categories: ShopeeCategoryOption[],
): ShopeeCategoryOption | null {
  if (categories.length === 0) return null;

  const titleWords = wordSet(product.title);
  const nicheHint = CURATION_NICHES.has(product.category)
    ? ""
    : (NICHE_HINTS[product.category] ?? product.category);
  const hintWords = wordSet(nicheHint);

  let best: ShopeeCategoryOption | null = null;
  let bestScore = 0;

  for (const candidate of categories) {
    const pathWords = wordSet(candidate.path);
    let score = 0;
    for (const w of titleWords) if (pathWords.has(w)) score += 2;
    for (const w of hintWords) if (pathWords.has(w)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore > 0 ? best : null;
}
