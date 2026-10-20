// Atualiza src/data/c7drop-products.ts com os dados da API pública da C7Drop.
// Roda sozinho pelo GitHub Actions (.github/workflows/c7drop-catalog.yml);
// também dá pra rodar na mão: `node scripts/update-c7drop-catalog.mjs`.
//
// Segurança: se a API falhar, mudar de formato ou devolver bem menos produtos
// que o arquivo atual, o script aborta SEM tocar no arquivo (exit 1).
// Se nada mudou, também não reescreve (o workflow então não faz commit).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../src/data/c7drop-products.ts", import.meta.url));
const API = process.env.C7DROP_API ?? "https://www.c7drop.com.br/api/products";
const MARKER = "export const C7DROP_PRODUCTS: C7DropProduct[] = [\n";
const MIN_RATIO = 0.7; // aborta se vier menos de 70% dos produtos atuais

function fail(msg) {
  console.error(`ERRO: ${msg}\nArquivo NÃO foi alterado.`);
  process.exit(1);
}

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

function readCurrent() {
  const src = readFileSync(FILE, "utf8");
  const i = src.indexOf(MARKER);
  if (i < 0) fail("não achei o array C7DROP_PRODUCTS no arquivo atual");
  const body = src.slice(i + MARKER.length - 2).trim().replace(/;\s*$/, "");
  // O corpo é um literal de objetos JS gerado por este mesmo script.
  const products = new Function(`return ${body};`)();
  return { src, header: src.slice(0, i), products };
}

function format(header, products) {
  const rows = products.map(
    (p) =>
      `  {\n` +
      `    id: ${JSON.stringify(p.id)},\n` +
      `    name: ${JSON.stringify(p.name)},\n` +
      `    slug: ${JSON.stringify(p.slug)},\n` +
      `    priceCents: ${p.priceCents},\n` +
      `    compareAtPriceCents: ${p.compareAtPriceCents === null ? "null" : p.compareAtPriceCents},\n` +
      `    image: ${JSON.stringify(p.image)},\n` +
      `    category: ${JSON.stringify(p.category)},\n` +
      `    stock: ${p.stock},\n` +
      `    manageStock: ${p.manageStock},\n` +
      `  },\n`,
  );
  return header + MARKER + rows.join("") + "];\n";
}

const current = readCurrent();

// 1. Coleta todas as páginas.
const first = await getJson(`${API}?page=1&limit=50&sort=relevance`).catch((e) => fail(e.message));
if (!Array.isArray(first?.products) || !Number.isInteger(first?.totalPages)) {
  fail("formato da resposta mudou (esperava {products: [], totalPages})");
}
const pages = [first];
for (let p = 2; p <= first.totalPages; p++) {
  pages.push(await getJson(`${API}?page=${p}&limit=50&sort=relevance`).catch((e) => fail(e.message)));
}
const raw = pages.flatMap((pg) => pg.products ?? []);

// 2. Valida.
if (typeof first.total === "number" && raw.length !== first.total) {
  fail(`API diz ${first.total} produtos mas vieram ${raw.length}`);
}
const ids = new Set(raw.map((p) => p.id));
if (ids.size !== raw.length) fail("IDs duplicados na resposta");
if (raw.length < current.products.length * MIN_RATIO) {
  fail(`vieram só ${raw.length} produtos (arquivo atual tem ${current.products.length})`);
}
for (const p of raw) {
  const ok =
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.slug === "string" &&
    typeof p.price === "number" &&
    (p.compareAtPrice === null || typeof p.compareAtPrice === "number") &&
    typeof p.image === "string" &&
    Array.isArray(p.categories) &&
    typeof p.stock === "number" &&
    typeof p.manageStock === "boolean";
  if (!ok) fail(`produto com formato inesperado: ${JSON.stringify(p).slice(0, 200)}`);
}

// 3. Descobre se o preço vem em reais ou centavos comparando com o arquivo atual
//    (a C7Drop já trocou isso uma vez sem aviso).
const oldById = new Map(current.products.map((p) => [p.id, p]));
const ratios = raw
  .filter((p) => oldById.has(p.id) && p.price > 0)
  .map((p) => oldById.get(p.id).priceCents / p.price)
  .sort((a, b) => a - b);
if (ratios.length < 20) fail("poucos produtos em comum com o arquivo atual pra conferir a unidade do preço");
const median = ratios[Math.floor(ratios.length / 2)];
let factor;
if (median > 80 && median < 120) factor = 100; // API em reais
else if (median > 0.8 && median < 1.2) factor = 1; // API em centavos
else fail(`não deu pra saber a unidade do preço (razão mediana ${median.toFixed(2)})`);

const products = raw.map((p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  priceCents: Math.round(p.price * factor),
  compareAtPriceCents: p.compareAtPrice === null ? null : Math.round(p.compareAtPrice * factor),
  image: p.image,
  category: p.categories[0]?.name || "Outros",
  stock: p.stock,
  manageStock: p.manageStock,
}));

// 4. Só reescreve se os dados mudaram.
const oldBody = format("", current.products);
const newBody = format("", products);
if (oldBody === newBody) {
  console.log(`Sem mudanças (${products.length} produtos).`);
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const header = current.header.replace(
  /Snapshot de \d{4}-\d{2}-\d{2} — \d+ produtos/,
  `Snapshot de ${today} — ${products.length} produtos`,
);
writeFileSync(FILE, format(header, products));

const newIds = new Set(products.map((p) => p.id));
const added = products.filter((p) => !oldById.has(p.id)).length;
const removed = current.products.filter((p) => !newIds.has(p.id)).length;
const soldOut = (list) =>
  list.filter((p) => p.category !== "Fora de Estoque" && p.category !== "Anúncios em Massa" && p.manageStock && p.stock <= 0).length;
console.log(
  `Atualizado: ${current.products.length} → ${products.length} produtos ` +
    `(+${added} novos, -${removed} removidos). Esgotados visíveis: ${soldOut(current.products)} → ${soldOut(products)}.`,
);
