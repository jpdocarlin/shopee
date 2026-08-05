import type { DemoProduct } from "@/data/demo-products";
import { formatBRL } from "@/lib/format";

export type ScriptTone = "emoji" | "direto";

const LINK_PLACEHOLDER = "[cole aqui o seu link de afiliado]";

function discountPct(product: DemoProduct): number {
  if (!product.originalPriceCents) return 0;
  return Math.round((1 - product.priceCents / product.originalPriceCents) * 100);
}

export function generatePostScript(
  product: DemoProduct,
  options: { link?: string; tone?: ScriptTone } = {},
): string {
  const { link, tone = "emoji" } = options;
  const price = formatBRL(product.priceCents);
  const discount = discountPct(product);
  const finalLink = link?.trim() || LINK_PLACEHOLDER;

  if (tone === "direto") {
    const lines = [
      product.title,
      discount > 0
        ? `De ${formatBRL(product.originalPriceCents ?? 0)} por ${price} (${discount}% off).`
        : `Por ${price}.`,
      `Link: ${finalLink}`,
    ];
    return lines.join("\n");
  }

  const lines = [
    `🔥 ${product.title}`,
    discount > 0
      ? `De ~${formatBRL(product.originalPriceCents ?? 0)}~ por apenas ${price} (${discount}% OFF) 😱`
      : `Por apenas ${price} 👀`,
    `⭐ ${product.rating.toFixed(1)} · +${product.reviews.toLocaleString("pt-BR")} avaliações`,
    "",
    "Corre que costuma acabar rápido 🏃‍♀️",
    `👉 ${finalLink}`,
  ];
  return lines.join("\n");
}
