// Server-only: preço de DROPSHIPPING de um produto da C7Drop, consultado ao
// vivo (c7drop.com.br/api/products/{slug}) no momento em que importa — quando
// o revendedor escolhe o produto e quando o pedido é registrado.
//
// Por quê (22/10/2026): a C7Drop tem 3 tabelas de preço por produto (Grupo
// VIP, Atacado e Dropshipping) e reajusta ao longo do dia. O Shoppfy compra
// na tabela Dropshipping, mas o catálogo antigo mostrava o `price` da
// listagem (≈ Grupo VIP, ~R$ 6 mais barato) — o revendedor pagava menos e a
// diferença saía do bolso do Jp. O catálogo estático (src/data) agora também
// guarda o preço de Dropshipping, mas só é atualizado de tempos em tempos;
// esta consulta é a palavra final.
//
// A regra de leitura da tabela está duplicada em
// scripts/update-c7drop-catalog.mjs — mexeu aqui, mexa lá.
import { C7DROP_PRODUCTS } from "@/data/c7drop-products";

type C7DropVariant = {
  tier?: string | null;
  price?: number | null;
  value?: string | null;
  name?: string | null;
  stock?: number | null;
};

type C7DropDetail = {
  id?: string;
  price?: number;
  stock?: number;
  manageStock?: boolean;
  variants?: C7DropVariant[];
};

export type C7DropLivePrice = {
  productId: string;
  slug: string;
  priceCents: number;
  available: boolean;
  checkedAt: string;
  // Variações (cor etc.) da tabela Dropshipping com estoque — pra pessoa
  // escolher no pedido e a extensão marcar a mesma na C7.
  variants: Array<{ name: string; value: string }>;
};

// Preço da tabela Dropshipping, na unidade da API. Em alguns produtos a C7Drop
// cadastrou o preço no `value` da variação (ex.: "110") com `price` vazio. Com
// várias variações (cores) usa o MAIOR, pra nunca cobrar menos que a C7Drop.
function dropshippingPrice(detail: C7DropDetail): number | null {
  const prices: number[] = [];
  for (const v of detail.variants ?? []) {
    if (v?.tier !== "DROPSHIPPING") continue;
    if (typeof v.price === "number" && v.price > 0) prices.push(v.price);
    else if (typeof v.value === "string" && /^\d+([.,]\d+)?$/.test(v.value.trim())) {
      prices.push(Number(v.value.trim().replace(",", ".")));
    }
  }
  return prices.length ? Math.max(...prices) : null;
}

export async function getC7DropLivePrice(productId: string): Promise<C7DropLivePrice> {
  const snapshot = C7DROP_PRODUCTS.find((p) => p.id === productId);
  if (!snapshot) throw new Error("Produto não encontrado no catálogo da C7Drop.");

  let detail: C7DropDetail;
  try {
    const res = await fetch(
      `https://www.c7drop.com.br/api/products/${encodeURIComponent(snapshot.slug)}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    detail = (await res.json()) as C7DropDetail;
  } catch (err) {
    console.error("[c7drop-price] falha ao consultar a C7Drop:", err);
    throw new Error(
      "Não conseguimos confirmar o preço atual na C7Drop agora. Tente de novo em alguns minutos.",
    );
  }
  if (detail.id !== productId) {
    throw new Error("A C7Drop devolveu outro produto. Tente de novo em alguns minutos.");
  }

  const raw = dropshippingPrice(detail) ?? detail.price;
  if (typeof raw !== "number" || !(raw > 0)) {
    throw new Error("A C7Drop não informou o preço desse produto agora. Escolha outro produto.");
  }

  // A API já trocou de centavos pra reais sem aviso: escolhe a unidade que
  // fica mais perto do preço que já conhecemos e recusa se nenhuma bater.
  const asReais = Math.round(raw * 100);
  const asCents = Math.round(raw);
  const dist = (v: number) => Math.abs(Math.log(v / snapshot.priceCents));
  const priceCents = dist(asReais) <= dist(asCents) ? asReais : asCents;
  if (dist(priceCents) > Math.log(3)) {
    console.error("[c7drop-price] preço fora do esperado", {
      productId,
      raw,
      snapshot: snapshot.priceCents,
    });
    throw new Error(
      "O preço desse produto na C7Drop mudou de um jeito inesperado. Fale com o suporte antes de seguir.",
    );
  }

  const available = !(detail.manageStock === true && (detail.stock ?? 0) <= 0);
  const seen = new Set<string>();
  const variants: C7DropLivePrice["variants"] = [];
  for (const v of detail.variants ?? []) {
    if (v?.tier !== "DROPSHIPPING" || typeof v.value !== "string") continue;
    const value = v.value.trim();
    if (!value || /^\d+([.,]\d+)?$/.test(value)) continue; // preço no lugar do valor
    if (typeof v.stock === "number" && v.stock <= 0) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    variants.push({ name: (v.name ?? "Variação").trim() || "Variação", value });
  }
  return {
    productId,
    slug: snapshot.slug,
    priceCents,
    available,
    checkedAt: new Date().toISOString(),
    variants,
  };
}
