// Produtos com entrega rápida (chega em até 1 dia), verificado um a um via a
// API pública de detalhe de produto da Shopee (campo "estimated_days").
// Chave = productId (mesmo id usado em demo-products.ts / normal-links.ts).
// Só entram aqui os produtos já verificados com estimated_days <= 1; os demais
// caem no fallback "false" em demo-products.ts.
export const FAST_DELIVERY: Record<string, boolean> = {
  "40500564432": true,
  "27078723137": true,
  "25504395336": true,
};
