// Server-only: busca a galeria de fotos REAIS do produto direto na API
// pública da C7Drop (c7drop.com.br/api/products/{slug}) — usado na hora de
// publicar na Shopee, que exige pelo menos 3 fotos por anúncio (a C7Drop
// costuma ter 6-8 fotos por produto, então isso normalmente sobra).
//
// Em vez de pré-coletar e guardar essas fotos num arquivo estático pros
// ~900 produtos do catálogo (o que ficaria desatualizado assim que a C7Drop
// trocasse alguma foto), busca ao vivo no momento da publicação — sempre
// reflete a galeria atual de verdade.
export type C7DropGalleryImage = {
  url: string;
  order: number;
  isPrimary: boolean;
};

// productUrl é o link da página do produto na C7Drop (formato
// "https://www.c7drop.com.br/produto/{slug}", já salvo em cada produto do
// catálogo) — extrai o slug dali em vez de exigir mais um campo separado.
export async function getC7DropGalleryImages(
  productUrl: string,
  max = 5,
): Promise<string[]> {
  try {
    const slug = new URL(productUrl).pathname.split("/").filter(Boolean).pop();
    if (!slug) return [];

    const res = await fetch(`https://www.c7drop.com.br/api/products/${slug}`);
    if (!res.ok) return [];

    const data = (await res.json()) as { images?: C7DropGalleryImage[] };
    const images = (data.images ?? [])
      .slice()
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.order - b.order;
      })
      .map((img) => img.url);

    return images.slice(0, max);
  } catch (err) {
    console.error("[c7drop-images] falha ao buscar galeria:", err);
    return [];
  }
}
