// Server functions (RPC) pra Passo 5 do Criar Anúncio publicar direto na API
// oficial do Mercado Livre — categoria (via preditor oficial, ver
// predictCategory em mercadolivre-api.server.ts) e a publicação em si.
// Espelha shopee-product.functions.ts. Protegido por `requireSupabaseAuth`
// (precisa estar logado); a partir daí cada usuário só opera na PRÓPRIA
// loja Mercado Livre conectada.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Diferente da Shopee (que expõe uma lista inteira de categorias pro
// front casar por palavra-chave em shopee-category-match.ts), o Mercado
// Livre já devolve a categoria certa pronta a partir do preditor oficial —
// não precisa buscar/andar por uma árvore inteira aqui. Recebe o título do
// produto e devolve a categoria prevista (ou null, sem match confiável).
export const predictMercadoLivreCategory = createServerFn({ method: "GET" })
  .validator((data: { title: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { predictCategory } = await import("@/lib/mercadolivre-api.server");

    const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
    const prediction = await predictCategory(accessToken, data.title);
    return prediction;
  });

type PublishInput = {
  categoryId: string;
  itemName: string;
  description: string;
  priceReais: number;
  stock: number;
  imageUrl: string;
  // Link da página do produto na C7Drop — usado pra buscar a galeria real
  // de fotos na hora de publicar, igual no fluxo da Shopee.
  productUrl: string;
  // Pra gravar em Meus anúncios: produto do catálogo e custo no momento.
  productId?: string;
  costCents?: number;
};

// Junta só as mensagens/códigos dos "cause" do tipo error de uma resposta de
// erro do ML (o resto são avisos que não impedem a publicação). Sem JSON
// reconhecível, devolve a mensagem inteira.
function mercadoLivreErrorCauses(message: string): string {
  const start = message.indexOf("{");
  if (start < 0) return message;
  try {
    const json = JSON.parse(message.slice(start)) as {
      message?: string;
      cause?: Array<{ type?: string; code?: string; message?: string }>;
    };
    const errors = (json.cause ?? []).filter((c) => c.type !== "warning");
    if (!errors.length) return message;
    return errors.map((c) => `${c.code ?? ""} ${c.message ?? ""}`).join(" | ");
  } catch {
    return message;
  }
}

export const publishMercadoLivreProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: PublishInput) => data)
  .handler(async ({ context, data }) => {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { getCategoryAttributes, buildMandatoryAttributeList, emptyGtinReason, publishProduct } =
      await import("@/lib/mercadolivre-api.server");
    const { getC7DropGalleryImages } = await import("@/lib/c7drop-images.server");

    const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);

    // Junta a foto de capa com a galeria real do produto na C7Drop (até 5
    // fotos) — o ML aceita URL direto no corpo do POST /items, sem precisar
    // subir bytes pra um endpoint de upload separado (diferente da Shopee).
    const galleryUrls = await getC7DropGalleryImages(data.productUrl);
    const imageUrls = [data.imageUrl, ...galleryUrls.filter((url) => url !== data.imageUrl)];

    // Cada categoria do ML exige um conjunto diferente de atributos
    // obrigatórios (ex.: Marca/Modelo em Celulares) — resolve
    // automaticamente, igual à Shopee. Falhando a busca, segue sem
    // atributos em vez de travar a publicação inteira.
    let attributeList: ReturnType<typeof buildMandatoryAttributeList> = [];
    try {
      const attributes = await getCategoryAttributes(accessToken, data.categoryId);
      attributeList = buildMandatoryAttributeList(attributes, data.itemName);
    } catch {
      // categoria pode não ter atributos obrigatórios — segue sem eles.
    }

    const publish = (attrs: typeof attributeList) =>
      publishProduct({
        accessToken,
        categoryId: data.categoryId,
        itemName: data.itemName,
        description: data.description,
        priceReais: data.priceReais,
        stock: data.stock,
        imageUrls,
        attributeList: attrs,
      });

    // Tenta de novo corrigindo o que o ML reclamou (no máximo 3 tentativas):
    //   - GTIN (código de barras) sem EMPTY_GTIN_REASON → informa "sem código";
    //   - campo ANATEL recusado → manda sem os campos ANATEL (só quando o ML
    //     não exige o campo; se exigir, o erro segue pra tela explicando).
    // Só olha os "cause" do tipo error (o ML também manda avisos, ex.: envio).
    let result: Awaited<ReturnType<typeof publishProduct>> | null = null;
    let attrs = attributeList;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await publish(attrs);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const errors = mercadoLivreErrorCauses(msg);
        if (/GTIN/i.test(errors) && !attrs.some((a) => a.id === "EMPTY_GTIN_REASON")) {
          attrs = [...attrs, emptyGtinReason()];
          continue;
        }
        if (
          /ANATEL|HOMOLOGATION/i.test(errors) &&
          attrs.some((a) => /ANATEL|HOMOLOG/i.test(a.id))
        ) {
          console.warn("[MercadoLivre] campo ANATEL recusado, tentando sem ele:", errors);
          attrs = attrs.filter((a) => !/ANATEL|HOMOLOG/i.test(a.id));
          continue;
        }
        throw err;
      }
    }
    if (!result) throw lastErr ?? new Error("Não foi possível publicar no Mercado Livre agora.");

    if (result.itemId) {
      const { recordPublishedListing } = await import("@/lib/listings.server");
      await recordPublishedListing({
        userId: context.userId,
        marketplace: "mercado-livre",
        externalId: String(result.itemId),
        productId: data.productId ?? null,
        title: data.itemName,
        imageUrl: data.imageUrl,
        permalink: result.permalink,
        priceCents: Math.round(data.priceReais * 100),
        costCents: data.costCents ?? null,
      }).catch((err) => console.error("[listings] falha ao gravar:", err));
    }

    return { itemId: result.itemId, permalink: result.permalink };
  });
