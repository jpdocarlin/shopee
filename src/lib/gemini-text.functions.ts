// Server function (RPC) da mini-história do post.
// A implementação real fica em gemini-text.server.ts, carregada dinamicamente
// dentro do handler — nunca importada no topo (ver o comentário de segurança
// naquele arquivo).
import { createServerFn } from "@tanstack/react-start";

export const generateProductStory = createServerFn({ method: "POST" })
  .validator(
    (data: {
      title: string;
      category?: string;
      priceCents?: number;
      originalPriceCents?: number | null;
      variant?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { generateProductStory: generate } = await import("@/lib/gemini-text.server");
    return generate(data);
  });
