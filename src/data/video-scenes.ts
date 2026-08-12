export type VideoScenario = {
  id: string;
  label: string;
  prompt: string;
};

export type VideoShotType = {
  id: string;
  label: string;
  description: string;
  /** Usa o placeholder "{pessoa}" onde a descrição de gênero deve entrar. */
  template: string;
  /** O que NÃO pode aparecer. Vira instrução negativa explícita no prompt. */
  negative: string;
  /** true = ninguém aparece em quadro, então a fala do vídeo é narração em off. */
  voiceOver: boolean;
};

export type VideoGender = {
  id: string;
  label: string;
  prompt: string;
  /** Só a mão — usado no POV, onde a pessoa não aparece. */
  handPrompt: string;
  /** Como descrever a voz no prompt de vídeo. */
  voicePrompt: string;
};

/** ID especial: quando selecionado, o texto do cenário vem do campo livre digitado pela pessoa. */
export const CUSTOM_SCENARIO_ID = "personalizado";

/** Cenários pra imagem de referência de vídeo — genéricos, servem pra qualquer produto. */
export const VIDEO_SCENARIOS: VideoScenario[] = [
  {
    id: "sala",
    label: "Sala de estar",
    prompt: "num ambiente de sala de estar aconchegante, sofá e iluminação natural ao fundo",
  },
  {
    id: "cozinha",
    label: "Cozinha",
    prompt: "numa cozinha moderna e organizada, bancada ao fundo",
  },
  {
    id: "quarto",
    label: "Quarto",
    prompt: "num quarto claro e arrumado, luz suave, cama ao fundo",
  },
  {
    id: "escritorio",
    label: "Mesa / setup",
    prompt:
      "numa mesa de escritório ou setup, com computador e itens de trabalho desfocados ao fundo",
  },
  {
    id: "externo",
    label: "Ambiente externo",
    prompt: "ao ar livre, em um ambiente externo bem iluminado, como uma varanda ou quintal",
  },
  {
    id: "carro",
    label: "Dentro do carro",
    prompt: "dentro de um carro, banco do carona, luz do dia entrando pela janela",
  },
  {
    id: CUSTOM_SCENARIO_ID,
    label: "Personalizado",
    prompt: "",
  },
];

/** Quem aparece na cena — entra no lugar de "{pessoa}" nos templates abaixo. */
export const VIDEO_GENDERS: VideoGender[] = [
  {
    id: "mulher",
    label: "Mulher",
    prompt: "uma mulher jovem brasileira",
    handPrompt: "uma mão feminina jovem, de pele brasileira",
    voicePrompt: "voz feminina jovem brasileira",
  },
  {
    id: "homem",
    label: "Homem",
    prompt: "um homem jovem brasileiro",
    handPrompt: "uma mão masculina jovem, de pele brasileira",
    voicePrompt: "voz masculina jovem brasileira",
  },
];

/** Formatos de vídeo achadinhos mais comuns. */
export const VIDEO_SHOT_TYPES: VideoShotType[] = [
  {
    id: "pov",
    label: "POV (mão + produto)",
    description: "Só aparece a mão segurando o produto, sem mostrar o rosto.",
    // Descreve SÓ a mão. Antes entrava "um homem jovem brasileiro" aqui e o
    // modelo desenhava a pessoa inteira em quadro, mesmo com o "sem rosto".
    template:
      "Enquadramento POV em primeira pessoa, close: em quadro existem APENAS {pessoa} e o antebraço correspondente, segurando o produto em primeiro plano, bem perto da câmera. A câmera está na posição dos olhos de quem segura, olhando pra própria mão. O produto ocupa o centro do quadro e está em foco total",
    negative:
      "Nenhuma pessoa visível em quadro: sem rosto, sem cabeça, sem cabelo, sem olhos, sem boca, sem pescoço, sem ombros, sem tronco, sem corpo, sem retrato, sem selfie, sem outra pessoa ao fundo, sem reflexo de pessoa em espelho ou vidro. Somente mão, antebraço e produto",
    voiceOver: true,
  },
  {
    id: "selfie",
    label: "Selfie (rosto + celular)",
    description: "Pessoa segurando o celular numa mão e o produto na outra, perto do rosto.",
    template:
      "Selfie estilo vlog de rede social: {pessoa} segura o celular esticando o braço em direção à câmera com uma mão, e segura o produto na outra mão perto do rosto, sorrindo, como quem está gravando um depoimento",
    negative:
      "Apenas uma pessoa em quadro, sem outras pessoas ao fundo. Sem texto sobreposto na imagem",
    voiceOver: false,
  },
  {
    id: "produto-mao",
    label: "Produto na mão, celular parado",
    description: "Pessoa segura o produto com as mãos livres; o celular fica apoiado, parado.",
    template:
      "{pessoa} segura o produto com as duas mãos mostrando-o de frente pra câmera, como um vídeo de demonstração/review; o celular está parado, apoiado num suporte, fora de quadro",
    negative:
      "Apenas uma pessoa em quadro, sem outras pessoas ao fundo. O celular que grava não aparece na cena. Sem texto sobreposto na imagem",
    voiceOver: false,
  },
];

export function getScenarioPrompt(id: string, customText?: string): string {
  if (id === CUSTOM_SCENARIO_ID) {
    const custom = customText?.trim();
    return custom ? custom : VIDEO_SCENARIOS[0].prompt;
  }
  return VIDEO_SCENARIOS.find((s) => s.id === id)?.prompt ?? VIDEO_SCENARIOS[0].prompt;
}

export function getShotType(shotTypeId: string): VideoShotType {
  return VIDEO_SHOT_TYPES.find((s) => s.id === shotTypeId) ?? VIDEO_SHOT_TYPES[0];
}

export function getGender(genderId: string): VideoGender {
  return VIDEO_GENDERS.find((g) => g.id === genderId) ?? VIDEO_GENDERS[0];
}

/** Descrição do enquadramento já com o gênero aplicado (sem as negativas). */
export function getShotTypePrompt(shotTypeId: string, genderId: string): string {
  const shot = getShotType(shotTypeId);
  const gender = getGender(genderId);
  // No POV a pessoa não aparece — entra só a descrição da mão, senão o modelo
  // desenha o corpo inteiro mesmo com a instrução de "sem rosto".
  const pessoa = shot.voiceOver ? gender.handPrompt : gender.prompt;
  return shot.template.replace("{pessoa}", pessoa);
}
