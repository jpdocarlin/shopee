import { getGender, getScenarioPrompt, getShotType, getShotTypePrompt } from "@/data/video-scenes";
import { shortProductName } from "@/lib/video-script";

// Monta o prompt pronto pra colar no Flow (Veo), junto com a imagem da cena
// como referência. A ideia é travar TUDO que já foi decidido na hora de gerar a
// foto — produto, cenário, enquadramento, quem aparece — pro Flow só dar
// movimento e voz, sem reinventar a cena.

export type FlowPromptInput = {
  productTitle: string;
  scenarioId: string;
  customScenario?: string;
  genderId: string;
  shotTypeId: string;
  /** A fala do vídeo (o script gerado logo acima na tela). */
  script: string;
  durationSeconds?: number;
};

export function buildFlowPrompt({
  productTitle,
  scenarioId,
  customScenario,
  genderId,
  shotTypeId,
  script,
  durationSeconds = 10,
}: FlowPromptInput): string {
  const shot = getShotType(shotTypeId);
  const gender = getGender(genderId);
  const scenario = getScenarioPrompt(scenarioId, customScenario);
  const framing = getShotTypePrompt(shotTypeId, genderId);

  // No POV ninguém aparece, então a fala é narração em off — pedir lip sync
  // faria o Flow inventar um rosto em quadro.
  const audioLine = shot.voiceOver
    ? `Narração em off (a pessoa NÃO aparece em quadro), ${gender.voicePrompt}, tom animado e natural de vídeo de rede social, falando em português do Brasil exatamente este texto:`
    : `A pessoa que aparece na cena fala olhando para a câmera, ${gender.voicePrompt}, com os lábios sincronizados com o áudio, tom animado e natural de vídeo de rede social, em português do Brasil, exatamente este texto:`;

  // Movimento: sutil de propósito. Movimento grande é o que faz o modelo
  // "escapar" do frame de referência e trocar produto/cenário no meio.
  const motion = shot.voiceOver
    ? "A mão gira o produto bem devagar, mostrando os detalhes. Câmera praticamente parada, leve respiração de câmera na mão."
    : "Movimento natural e sutil: a pessoa gesticula pouco e aproxima levemente o produto da câmera. Câmera praticamente parada.";

  return [
    `Gere um vídeo de ${durationSeconds} segundos a partir da imagem de referência anexada.`,
    "",
    "MANTENHA IDÊNTICO À IMAGEM DE REFERÊNCIA — não mude absolutamente nada:",
    `- O produto é "${shortProductName(productTitle, 10)}". Mesma cor, formato, material, rótulo e embalagem. Não troque o produto, não redesenhe, não estilize, não adicione nem remova nada dele.`,
    `- O cenário é: ${scenario}. Não mude o ambiente, não mude o fundo, não mude a iluminação, não acrescente objetos novos.`,
    "- Mesma pessoa (ou mesma mão), mesma roupa, mesma pele, mesmo enquadramento e mesmo ângulo da foto.",
    "",
    `ENQUADRAMENTO (obrigatório, igual à foto): ${framing}.`,
    `NÃO PODE APARECER: ${shot.negative}.`,
    "",
    `MOVIMENTO: ${motion} Sem corte, sem transição, sem zoom brusco, plano único do começo ao fim.`,
    "",
    `ÁUDIO: ${audioLine}`,
    `"${script.trim()}"`,
    "",
    `FORMATO: vertical 9:16, ${durationSeconds} segundos, fotorrealista, qualidade de celular moderno.`,
    "NÃO INCLUIR: legenda ou texto na tela, marca d'água, logo, música alta por cima da voz, outra pessoa em quadro, mudança de cenário ou de produto no meio do vídeo.",
  ].join("\n");
}
