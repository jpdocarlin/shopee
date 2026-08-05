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
};

export type VideoGender = {
  id: string;
  label: string;
  prompt: string;
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
  { id: "mulher", label: "Mulher", prompt: "uma mulher jovem brasileira" },
  { id: "homem", label: "Homem", prompt: "um homem jovem brasileiro" },
];

/** Formatos de vídeo achadinhos mais comuns. */
export const VIDEO_SHOT_TYPES: VideoShotType[] = [
  {
    id: "pov",
    label: "POV (mão + produto)",
    description: "Só aparece a mão segurando o produto, sem mostrar o rosto.",
    template:
      "Vídeo em ponto de vista (POV), primeira pessoa: aparecem apenas a mão e o antebraço de {pessoa} segurando o produto, sem mostrar rosto ou corpo, foco total no produto",
  },
  {
    id: "selfie",
    label: "Selfie (rosto + celular)",
    description: "Pessoa segurando o celular numa mão e o produto na outra, perto do rosto.",
    template:
      "Selfie estilo vlog de rede social: {pessoa} segura o celular esticando o braço em direção à câmera com uma mão, e segura o produto na outra mão perto do rosto, sorrindo, como quem está gravando um depoimento",
  },
  {
    id: "produto-mao",
    label: "Produto na mão, celular parado",
    description: "Pessoa segura o produto com as mãos livres; o celular fica apoiado, parado.",
    template:
      "{pessoa} segura o produto com as duas mãos mostrando-o de frente pra câmera, como um vídeo de demonstração/review; o celular está parado, apoiado num suporte, fora de quadro",
  },
];

export function getScenarioPrompt(id: string, customText?: string): string {
  if (id === CUSTOM_SCENARIO_ID) {
    const custom = customText?.trim();
    return custom ? custom : VIDEO_SCENARIOS[0].prompt;
  }
  return VIDEO_SCENARIOS.find((s) => s.id === id)?.prompt ?? VIDEO_SCENARIOS[0].prompt;
}

export function getShotTypePrompt(shotTypeId: string, genderId: string): string {
  const shot = VIDEO_SHOT_TYPES.find((s) => s.id === shotTypeId) ?? VIDEO_SHOT_TYPES[0];
  const gender = VIDEO_GENDERS.find((g) => g.id === genderId) ?? VIDEO_GENDERS[0];
  return shot.template.replace("{pessoa}", gender.prompt);
}
