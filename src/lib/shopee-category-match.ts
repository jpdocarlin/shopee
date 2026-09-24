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
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "com",
  "para",
  "pra",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "o",
  "a",
  "os",
  "as",
  "por",
  "sem",
  "mais",
  "menos",
  "ate",
  "ou",
  "que",
  "se",
  "ao",
  "aos",
  "the",
  "and",
  "for",
  "com",
  "novo",
  "nova",
  "kit",
  "unidade",
  "unidades",
  "cor",
  "cores",
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

// 23/09/2026: descoberto ao vivo — o casamento por palavra exata (sem
// singular/plural) estava escolhendo categoria errada pra produtos comuns.
// Dois casos reais confirmados: um "Adaptador Divisor..." caiu em "Ferragens
// e Fechaduras para Portas" (a categoria certa teria "Adaptadores" no
// caminho, mas "adaptador" ≠ "adaptadores" como string), e um "Microfone
// Lapela Sem Fio..." caiu em "Adaptadores sem Fio e Placas de Rede" só pela
// palavra genérica "fio", porque "microfone" ≠ "microfones" (a categoria
// certa de áudio). Sem essa normalização, o score da categoria certa fica
// zerado e uma categoria errada com overlap coincidental vence — pior ainda
// quando a categoria errada exige atributo que a certa não pede (o caso do
// adaptador caiu numa categoria que pede atributos de fechadura; o do
// microfone, numa que puxa validação de ANATEL de placa de rede).
// stem() reduz plurais comuns em português (não é um stemmer linguístico
// completo, só cobre os padrões mais frequentes em nome de produto) — é
// aplicado nos dois lados da comparação (título/nicho e caminho da
// categoria), então só ajuda a casar pares que hoje ficam sem crédito
// nenhum; não quebra nada que já casava certo.
function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith("res")) return word.slice(0, -2); // adaptadores -> adaptador
  if (word.endsWith("zes")) return word.slice(0, -2); // luzes -> luz
  if (word.endsWith("s")) return word.slice(0, -1); // microfones -> microfone, capas -> capa
  return word;
}

function wordSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem),
  );
}

// 23/09/2026: descoberto ao vivo — "Luminária Mesa Abajur Articulável
// Escritório Com Ventilador" (uma luminária de mesa com um ventilador
// integrado, nicho "Iluminação" no catálogo) caiu em "Eletrodomésticos
// Grandes / Resfriamento / Ventiladores" (categoria de ventilador de
// verdade). Causa: TODA palavra do título valia o mesmo peso (2x), então a
// palavra secundária "ventilador" (uma feature do produto, não o produto em
// si) pesou igual à palavra que de fato descreve o produto ("luminária"),
// e por acaso ainda casou com "mesa" também presente no nome da categoria de
// ventilador ("Ventilador de Mesa"). Isso é grave além de ser só categoria
// errada: essa categoria de eletrodoméstico regulado exige homologação
// ANATEL, que o produto não tem e não pode ser preenchida automaticamente —
// então a publicação trava sem necessidade nenhuma.
// Fix: dar peso cheio só pras primeiras palavras significativas do título
// (onde normalmente mora a IDENTIDADE do produto: "Luminária Mesa Abajur"),
// e peso reduzido pra palavras que aparecem depois (geralmente describem
// uma feature secundária: "...Com Ventilador"). Não muda em nada os casos
// já corrigidos antes (adaptador/microfone), onde a palavra certa já vinha
// logo no início do título.
const FULL_WEIGHT_TITLE_WORDS = 3;
const SECONDARY_WORD_WEIGHT_FACTOR = 0.5;

function titleWordWeights(title: string): Map<string, number> {
  const words = normalize(title)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
  const weights = new Map<string, number>();
  let significantIndex = 0;
  for (const w of words) {
    const weight = significantIndex < FULL_WEIGHT_TITLE_WORDS ? 1 : SECONDARY_WORD_WEIGHT_FACTOR;
    // Se a palavra repete mais adiante, mantém o maior peso já visto.
    weights.set(w, Math.max(weights.get(w) ?? 0, weight));
    significantIndex += 1;
  }
  return weights;
}

// 23/09/2026: descoberto ao vivo, DEPOIS do stem() acima já estar no ar —
// mesmo com singular/plural normalizado, o microfone continuava caindo em
// "Adaptadores sem Fio e Placas de Rede". Causa: toda palavra do título
// valia os mesmos +2 pontos, então uma palavra genérica que aparece em
// dezenas de categorias (ex.: "fio", que casa com Fio Dental, Telefones com
// Fio, Telefones sem Fio, Adaptadores sem Fio...) empatava com a palavra
// realmente específica do produto (ex.: "microfone", que só existe em
// "Áudio / Microfones"). No empate, `pickBestCategory` mantém a primeira
// categoria encontrada — ou seja, quem decidia era a ORDEM da lista da
// Shopee, não a relevância. buildDocFreq + idfWeight pesa cada palavra pela
// raridade dela no conjunto de categorias (igual TF-IDF): "microfone"
// aparece numa categoria só (peso alto), "fio" aparece em ~5 (peso baixo).
// Isso faz a palavra específica do produto valer muito mais que uma palavra
// genérica coincidente, sem precisar de dicionário manual por produto.
function buildDocFreq(categories: ShopeeCategoryOption[]): {
  docFreq: Map<string, number>;
  pathWordsById: Map<number, Set<string>>;
} {
  const docFreq = new Map<string, number>();
  const pathWordsById = new Map<number, Set<string>>();
  for (const candidate of categories) {
    const words = wordSet(candidate.path);
    pathWordsById.set(candidate.id, words);
    for (const w of words) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  }
  return { docFreq, pathWordsById };
}

function idfWeight(word: string, docFreq: Map<string, number>, totalCategories: number): number {
  const freq = docFreq.get(word) ?? 0;
  // +1 em cima e embaixo evita log(0)/divisão por zero; o "+1" final garante
  // peso mínimo 1 mesmo pra palavra presente em toda categoria (nunca chega
  // a zerar o placar de uma palavra que efetivamente bateu).
  return Math.log((totalCategories + 1) / (freq + 1)) + 1;
}

// Termos extras por nicho do catálogo C7Drop pra reforçar o casamento — só
// entram nichos onde vale a pena (nichos que já são "curadoria" tipo
// "Produtos diversos", "Mais vendidos", "Promoções do Mês", "Outros" e
// "Copa do Mundo" ficam de fora de propósito: não são um tipo de produto,
// então usar só o título do produto dá resultado mais confiável do que
// forçar um sinônimo genérico.
const NICHE_HINTS: Record<string, string> = {
  "Casa e Utensílios Domésticos":
    "casa utensilios domesticos cozinha organizador organizacao limpeza utilidades lar decoracao",
  Brinquedos: "brinquedo brinquedos infantil crianca boneca pelucia bebe",
  Informática:
    "informatica computador notebook pc periferico teclado mouse acessorios de informatica",
  Ferramentas: "ferramenta ferramentas furadeira parafusadeira chave bricolagem oficina construcao",
  "Beleza e Cuidado Pessoal": "beleza cuidado pessoal cosmetico skincare cabelo pele higiene",
  Câmeras: "camera cameras fotografia filmadora seguranca vigilancia",
  // 23/09/2026: só "iluminacao luminaria lampada luz led" empatava produto de
  // luminária de casa/escritório com categoria de LÂMPADA AUTOMOTIVA (as duas
  // têm "iluminação"/"lâmpada" no caminho) — ver UNEXPLAINED_PATH_WORD_PENALTY
  // abaixo. Reforçado com os tipos de luminária doméstica mais comuns na
  // Shopee (abajur, arandela, plafon, pendente, spot, trilho) + palavras de
  // cômodo (quarto, sala, teto, parede) pra puxar o placar pra categoria de
  // casa/decoração quando ela existir, sem tirar nada do que já funcionava.
  Iluminação:
    "iluminacao luminaria lampada luz led abajur arandela plafon pendente spot trilho teto parede quarto sala decoracao",
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

// 23/09/2026: descoberto ao vivo, DEPOIS do fix de peso posicional acima já
// estar no ar — a "Luminária Mesa Abajur Articulável Escritório Com
// Ventilador" parou de cair na categoria perigosa de eletrodoméstico
// (Ventiladores), mas passou a cair em "Peças e Acessórios para Veículos /
// Peças de Reposição para Automóveis / Iluminação / Lâmpadas" — categoria de
// lâmpada automotiva, não de luminária de casa/escritório. Causa: nem
// "iluminação" nem "lâmpada" aparecem literalmente no título (só no HINT do
// nicho "Iluminação"), então tanto essa categoria automotiva quanto uma
// eventual categoria de iluminação doméstica batem exatamente as MESMAS 2
// palavras de hint — empate. No empate, a função ficava com a primeira
// categoria encontrada na lista da própria Shopee: quem decidia era a ORDEM
// da API, não a relevância pro produto.
// Fix: além de somar pontos pelas palavras que BATEM, agora também SUBTRAI
// pontos pelas palavras do CAMINHO que sobram sem explicação nenhuma (nem no
// título, nem no hint do nicho) — ponderado pela mesma raridade (idf) já
// usada acima. "Veículos" e "Automóveis" são palavras específicas (aparecem
// numa fatia pequena da árvore de categorias) que não têm nenhuma relação
// com uma luminária de mesa, então custam caro; "Casa" ou "Decoração", por
// exemplo, são genéricas (aparecem em muitas categorias) e quase não pesam.
// Isso desempata a favor da categoria cujo caminho INTEIRO é mais bem
// explicado pelo produto, sem precisar de lista manual de categorias
// proibidas por nicho.
// 23/09/2026: 0.5 não bastou pro caso real (automotivo ainda venceu, porque
// "peças"/"acessórios" são palavras usadas em MUITAS seções da Shopee além de
// veículos — carro, celular, informática etc. — então o idf delas é baixo e a
// penalidade saiu fraca). Subido pra 1.2: ainda deixa passar palavras de
// caminho realmente genéricas (idf baixo => penalidade baixa mesmo com fator
// maior), mas penaliza de verdade uma palavra específica sem nenhuma relação
// com o produto quando ela aparece.
const UNEXPLAINED_PATH_WORD_PENALTY = 1.2;

// Escolhe a categoria-folha da Shopee com mais palavras em comum com o
// produto. Palavras vindas do TÍTULO valem o dobro de palavras vindas do
// nicho (o título descreve o produto de verdade; o nicho é só uma pista) —
// e dentro do título, as primeiras palavras (a identidade do produto) valem
// mais que as últimas (geralmente uma feature secundária, ver
// titleWordWeights()). Palavras do caminho da categoria que não batem com
// nada do produto pesam contra (ver UNEXPLAINED_PATH_WORD_PENALTY acima). Se
// nada bater (score 0 em toda a lista), devolve null — quem chama decide o
// fallback.
export function pickBestCategory(
  product: { title: string; category: string },
  categories: ShopeeCategoryOption[],
): ShopeeCategoryOption | null {
  if (categories.length === 0) return null;

  const titleWeights = titleWordWeights(product.title);
  const nicheHint = CURATION_NICHES.has(product.category)
    ? ""
    : (NICHE_HINTS[product.category] ?? product.category);
  const hintWords = wordSet(nicheHint);

  const { docFreq, pathWordsById } = buildDocFreq(categories);

  let best: ShopeeCategoryOption | null = null;
  let bestScore = 0;

  for (const candidate of categories) {
    const pathWords = pathWordsById.get(candidate.id) ?? wordSet(candidate.path);
    let score = 0;
    for (const [w, weight] of titleWeights)
      if (pathWords.has(w)) score += 2 * weight * idfWeight(w, docFreq, categories.length);
    for (const w of hintWords)
      if (pathWords.has(w)) score += 1 * idfWeight(w, docFreq, categories.length);
    for (const w of pathWords)
      if (!titleWeights.has(w) && !hintWords.has(w))
        score -= UNEXPLAINED_PATH_WORD_PENALTY * idfWeight(w, docFreq, categories.length);

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore > 0 ? best : null;
}
