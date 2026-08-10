// Server functions (RPC) para geração de imagem com IA.
// Implementação real fica em gemini-image.server.ts, carregada dinamicamente
// dentro do handler — nunca importada no topo do arquivo (ver o comentário
// de segurança em gemini-image.server.ts).
import { createServerFn } from "@tanstack/react-start";

export const generateProductPhoto = createServerFn({ method: "POST" })
  .validator((data: { title: string; category: string }) => data)
  .handler(async ({ data }) => {
    const { generateProductPhoto: generate } = await import("@/lib/gemini-image.server");
    return generate(data);
  });

export const generateEnhancedProductPhoto = createServerFn({ method: "POST" })
  .validator((data: { title: string; category?: string; productImageUrl: string }) => data)
  .handler(async ({ data }) => {
    const { generateEnhancedProductPhoto: generate } = await import("@/lib/gemini-image.server");
    return generate(data);
  });

export const generateVideoScenePhoto = createServerFn({ method: "POST" })
  .validator(
    (data: {
      title: string;
      category: string;
      productImageUrl: string;
      scenarioId: string;
      customScenario?: string;
      genderId: string;
      shotTypeId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { generateVideoScenePhoto: generate } = await import("@/lib/gemini-image.server");
    return generate(data);
  });
