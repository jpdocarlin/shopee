// Catálogo de revenda (mesma lista e mesmos nomes/fotos do Criar Anúncio).
import { C7DROP_PRODUCTS, type C7DropProduct } from "@/data/c7drop-products";

// "Fora de Estoque" é usada como categoria em vez de flag, e "Anúncios em
// Massa" é curso, não produto físico — mesmas exclusões do picker.
const EXCLUDED_CATEGORIES = new Set(["Fora de Estoque", "Anúncios em Massa"]);
export const CATALOG = C7DROP_PRODUCTS.filter((p) => !EXCLUDED_CATEGORIES.has(p.category));

const byId = new Map(C7DROP_PRODUCTS.map((p) => [p.id, p]));

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "para",
  "pra",
  "e",
  "em",
  "a",
  "o",
  "p",
  "c",
]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function findCatalogProductById(id: string | null | undefined): C7DropProduct | null {
  return id ? (byId.get(id) ?? null) : null;
}

// Pedidos antigos têm o nome digitado à mão: tenta achar o produto do
// catálogo mais parecido (igual primeiro; senão, maior sobreposição de
// palavras, exigindo que a maioria das palavras digitadas bata).
export function findCatalogProductByName(name: string | null | undefined): C7DropProduct | null {
  if (!name) return null;
  const n = normalize(name);
  if (!n) return null;
  const exact = C7DROP_PRODUCTS.find((p) => normalize(p.name) === n);
  if (exact) return exact;

  const wanted = tokens(name);
  if (wanted.length === 0) return null;
  let best: C7DropProduct | null = null;
  let bestScore = 0;
  // Palavra "bate" se for igual ou se as 5 primeiras letras baterem
  // (cílio/cilios, impermeável/impermeavel, comunicador/comunicadores).
  const stem = (t: string) => t.slice(0, 5);
  for (const p of C7DROP_PRODUCTS) {
    const have = tokens(p.name);
    const haveSet = new Set(have);
    const haveStems = new Set(have.map(stem));
    let hits = 0;
    for (const t of wanted) if (haveSet.has(t) || (t.length >= 4 && haveStems.has(stem(t)))) hits++;
    // Penaliza nome do catálogo muito maior/menor (evita casar por 2 palavras soltas).
    const score = hits / Math.max(wanted.length, Math.min(have.length, wanted.length * 1.5));
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

export function resolveOrderProduct(order: {
  product_id?: string | null;
  product_name: string;
}): C7DropProduct | null {
  return findCatalogProductById(order.product_id) ?? findCatalogProductByName(order.product_name);
}
