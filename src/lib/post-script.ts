import { formatBRL } from "@/lib/format";

export type ScriptTone = "emoji" | "direto";

// Produto do catálogo (DemoProduct) tem preço/nota/avaliações — atende essa
// forma automaticamente. Um link salvo pela extensão do Chrome a partir de
// QUALQUER produto real da Shopee não tem esses dados (só título/imagem), por
// isso todos os campos além do título são opcionais aqui.
export type PostScriptProduct = {
  title: string;
  priceCents?: number;
  originalPriceCents?: number | null;
  rating?: number;
  reviews?: number;
};

const LINK_PLACEHOLDER = "[cole aqui o seu link de afiliado]";

function discountPct(product: PostScriptProduct): number {
  if (typeof product.priceCents !== "number" || !product.originalPriceCents) return 0;
  return Math.round((1 - product.priceCents / product.originalPriceCents) * 100);
}

export function generatePostScript(
  product: PostScriptProduct,
  options: { link?: string; tone?: ScriptTone } = {},
): string {
  const { link, tone = "emoji" } = options;
  const hasPrice = typeof product.priceCents === "number";
  const price = hasPrice ? formatBRL(product.priceCents as number) : undefined;
  const discount = discountPct(product);
  const finalLink = link?.trim() || LINK_PLACEHOLDER;
  const hasRating = typeof product.rating === "number" && typeof product.reviews === "number";

  if (tone === "direto") {
    const priceLine = hasPrice
      ? discount > 0
        ? `De ${formatBRL(product.originalPriceCents ?? 0)} por ${price} (${discount}% off).`
        : `Por ${price}.`
      : null;
    const lines = [product.title, priceLine, `Link: ${finalLink}`].filter(
      (l): l is string => l !== null,
    );
    return lines.join("\n");
  }

  const priceLine = hasPrice
    ? discount > 0
      ? `De ~${formatBRL(product.originalPriceCents ?? 0)}~ por apenas ${price} (${discount}% OFF) 😱`
      : `Por apenas ${price} 👀`
    : null;
  const ratingLine = hasRating
    ? `⭐ ${(product.rating as number).toFixed(1)} · +${(product.reviews as number).toLocaleString("pt-BR")} avaliações`
    : null;

  const lines = [
    `🔥 ${product.title}`,
    priceLine,
    ratingLine,
    "",
    "Corre que costuma acabar rápido 🏃‍♀️",
    `👉 ${finalLink}`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
