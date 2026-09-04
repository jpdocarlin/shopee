import type { Marketplace } from "@/stores/affiliate-store";

// Cálculo de taxa do marketplace pra quem vende como LOJISTA (revenda /
// dropshipping) — não tem nada a ver com a comissão de afiliado.
//
// IMPORTANTE: marketplace muda tabela de taxa com frequência. Os valores aqui
// são os vigentes em 2026 e a tela deixa o usuário editar a comissão %, então
// mesmo desatualizada a conta continua servindo. Sempre confira no painel do
// vendedor antes de precificar de verdade.

export type FeeTier = {
  /** Preço de venda até este valor (em centavos). null = sem teto. */
  maxPriceCents: number | null;
  /** Percentual sobre o preço de venda (0.20 = 20%). */
  rate: number;
  /** Taxa fixa por item vendido, em centavos. */
  fixedCents: number;
  label: string;
};

// Shopee Brasil, tabela vigente desde março/2026 (o teto de R$100 de comissão
// foi removido e as faixas passaram a ter fixo por item).
export const SHOPEE_TIERS: FeeTier[] = [
  { maxPriceCents: 7999, rate: 0.2, fixedCents: 400, label: "até R$ 79,99" },
  { maxPriceCents: 9999, rate: 0.14, fixedCents: 1600, label: "R$ 80 a R$ 99,99" },
  { maxPriceCents: 19999, rate: 0.14, fixedCents: 2000, label: "R$ 100 a R$ 199,99" },
  { maxPriceCents: null, rate: 0.14, fixedCents: 2600, label: "acima de R$ 200" },
];

// Mercado Livre cobra por tipo de anúncio (clássico ~12%, premium ~17%) e tem
// custo fixo por item barato. Usamos o clássico como padrão.
export const MERCADO_LIVRE_TIERS: FeeTier[] = [
  { maxPriceCents: 7899, rate: 0.12, fixedCents: 650, label: "até R$ 78,99 (clássico)" },
  { maxPriceCents: null, rate: 0.12, fixedCents: 0, label: "acima de R$ 79 (clássico)" },
];

export function getTiers(marketplace: Marketplace): FeeTier[] {
  return marketplace === "shopee" ? SHOPEE_TIERS : MERCADO_LIVRE_TIERS;
}

export function findTier(marketplace: Marketplace, priceCents: number): FeeTier {
  const tiers = getTiers(marketplace);
  return tiers.find((t) => t.maxPriceCents === null || priceCents <= t.maxPriceCents) ?? tiers[0];
}

export type PricingResult = {
  priceCents: number;
  costCents: number;
  /** Taxa total cobrada pelo marketplace (percentual + fixo). */
  feeCents: number;
  tier: FeeTier;
  /** O que sobra no bolso depois de pagar o produto e a taxa. */
  profitCents: number;
  /** Lucro sobre o preço de venda (0.25 = 25%). */
  marginPct: number;
  /** Quanto o preço representa em cima do custo (2 = dobro do custo). */
  markup: number;
};

export function calcPricing(
  marketplace: Marketplace,
  costCents: number,
  priceCents: number,
  extraCostCents = 0,
): PricingResult {
  const tier = findTier(marketplace, priceCents);
  const feeCents = Math.round(priceCents * tier.rate) + tier.fixedCents;
  const profitCents = priceCents - costCents - feeCents - extraCostCents;
  return {
    priceCents,
    costCents,
    feeCents,
    tier,
    profitCents,
    marginPct: priceCents > 0 ? profitCents / priceCents : 0,
    markup: costCents > 0 ? priceCents / costCents : 0,
  };
}

// Preço que entrega o lucro-alvo desejado. Como a taxa depende da faixa e a
// faixa depende do preço, testa faixa por faixa e fica na primeira em que o
// preço calculado realmente cai dentro dela (senão o resultado seria
// inconsistente perto das quebras de faixa, tipo os R$ 79,99 → R$ 80).
export function suggestPrice(
  marketplace: Marketplace,
  costCents: number,
  targetMarginPct: number,
  extraCostCents = 0,
): number {
  const tiers = getTiers(marketplace);
  const margin = Math.min(Math.max(targetMarginPct, 0), 0.9);

  for (const tier of tiers) {
    // preço = (custo + extras + fixo) / (1 - taxa% - margem%)
    const denominator = 1 - tier.rate - margin;
    if (denominator <= 0) continue;
    const price = Math.ceil((costCents + extraCostCents + tier.fixedCents) / denominator);
    const fitsTier = tier.maxPriceCents === null || price <= tier.maxPriceCents;
    if (fitsTier) return price;
  }

  // Se nenhuma faixa fechou, usa a última (sem teto).
  const last = tiers[tiers.length - 1];
  return Math.ceil((costCents + extraCostCents + last.fixedCents) / (1 - last.rate - margin));
}
