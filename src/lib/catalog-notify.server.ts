// Server-only: avisa os clientes (push no celular) quando o catálogo muda —
// produto novo, preço baixou, preço subiu, esgotou, voltou ao estoque.
//
// Como funciona: o catálogo é atualizado pelo GitHub Action a cada 2h (novo
// deploy). Um cron da Vercel chama /api/cron/catalog-notify; aqui comparamos o
// catálogo deste deploy com a última versão já avisada (catalog_snapshot) e
// mandamos as notificações das diferenças. A "trava" em catalog_notify_state
// garante que cada versão é avisada uma vez só, mesmo com chamadas em paralelo.
import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { C7DROP_PRODUCTS, type C7DropProduct } from "@/data/c7drop-products";
import { formatBRL } from "@/lib/format";
import { sendToAllCustomers, type PushPayload } from "@/lib/push.server";

// "Anúncios em Massa" é curso, não produto — fica fora dos avisos.
const IGNORED_CATEGORIES = new Set(["Anúncios em Massa"]);

type Item = { id: string; name: string; priceCents: number; inStock: boolean };

function toItem(p: C7DropProduct): Item {
  return {
    id: p.id,
    name: p.name.trim(),
    priceCents: p.priceCents,
    inStock: p.category !== "Fora de Estoque" && !(p.manageStock && p.stock <= 0),
  };
}

function currentCatalog(): Item[] {
  return C7DROP_PRODUCTS.filter((p) => !IGNORED_CATEGORIES.has(p.category)).map(toItem);
}

function versionOf(items: Item[]): string {
  const h = createHash("sha256");
  for (const i of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    h.update(`${i.id}|${i.priceCents}|${i.inStock ? 1 : 0}\n`);
  }
  return h.digest("hex").slice(0, 32);
}

type PriceChange = { item: Item; fromCents: number };

export type CatalogDiff = {
  added: Item[];
  priceDown: PriceChange[];
  priceUp: PriceChange[];
  backInStock: Item[];
  outOfStock: Item[];
};

function short(name: string, max = 48): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

function listNames(items: Item[], max = 2): string {
  const names = items.slice(0, max).map((i) => short(i.name, 40));
  const rest = items.length - names.length;
  return rest > 0 ? `${names.join(", ")} e mais ${rest}` : names.join(" e ");
}

function priceLine(c: PriceChange): string {
  return `${short(c.item.name, 40)}: ${formatBRL(c.fromCents)} → ${formatBRL(c.item.priceCents)}`;
}

// Uma notificação por tipo de mudança (no máximo 5 por atualização), pra não
// encher o celular de aviso quando muitos produtos mudam de uma vez.
export function buildNotifications(diff: CatalogDiff, stamp: string): PushPayload[] {
  const out: PushPayload[] = [];
  const url = "/criar-anuncio";

  if (diff.added.length > 0) {
    const n = diff.added.length;
    out.push({
      title: n === 1 ? "🆕 Produto novo no catálogo" : `🆕 ${n} produtos novos no catálogo`,
      body:
        n === 1
          ? `${short(diff.added[0].name, 70)} · custo ${formatBRL(diff.added[0].priceCents)}. Já dá pra anunciar!`
          : `${listNames(diff.added)}. Já dá pra anunciar!`,
      url,
      tag: `catalogo-novos-${stamp}`,
    });
  }

  if (diff.priceDown.length > 0) {
    const n = diff.priceDown.length;
    out.push({
      title: n === 1 ? "📉 Produto baixou de preço" : `📉 ${n} produtos baixaram de preço`,
      body:
        n === 1
          ? `${priceLine(diff.priceDown[0])}. Sua margem aumentou!`
          : `${diff.priceDown.slice(0, 2).map(priceLine).join(" · ")}${n > 2 ? ` e mais ${n - 2}` : ""}`,
      url,
      tag: `catalogo-baixou-${stamp}`,
    });
  }

  if (diff.priceUp.length > 0) {
    const n = diff.priceUp.length;
    out.push({
      title: n === 1 ? "📈 Reajuste de preço" : `📈 Reajuste de preço em ${n} produtos`,
      body: `${diff.priceUp.slice(0, 2).map(priceLine).join(" · ")}${n > 2 ? ` e mais ${n - 2}` : ""}. Confira o preço dos seus anúncios pra não vender no prejuízo.`,
      url,
      tag: `catalogo-subiu-${stamp}`,
    });
  }

  if (diff.backInStock.length > 0) {
    const n = diff.backInStock.length;
    out.push({
      title: n === 1 ? "✅ Voltou ao estoque" : `✅ ${n} produtos voltaram ao estoque`,
      body: `${listNames(diff.backInStock)}. Pode reativar os anúncios.`,
      url,
      tag: `catalogo-voltou-${stamp}`,
    });
  }

  if (diff.outOfStock.length > 0) {
    const n = diff.outOfStock.length;
    out.push({
      title: n === 1 ? "⚠️ Produto esgotou" : `⚠️ ${n} produtos esgotaram`,
      body: `${listNames(diff.outOfStock)}. Pause esses anúncios na sua loja pra não vender sem ter o produto.`,
      url,
      tag: `catalogo-esgotou-${stamp}`,
    });
  }

  return out;
}

export async function runCatalogNotify(): Promise<{
  status: "seeded" | "unchanged" | "notified";
  diff?: Record<keyof CatalogDiff, number>;
  sent?: number;
}> {
  const items = currentCatalog();
  const version = versionOf(items);

  // Trava: só quem conseguir trocar a versão segue (evita aviso duplicado).
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("catalog_notify_state")
    .update({ catalog_version: version, last_run_at: new Date().toISOString() })
    .eq("id", 1)
    .or(`catalog_version.is.null,catalog_version.neq.${version}`)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return { status: "unchanged" };

  try {
    return await diffAndNotify(items, version);
  } catch (err) {
    // Libera a trava pra próxima execução tentar de novo.
    await supabaseAdmin.from("catalog_notify_state").update({ catalog_version: null }).eq("id", 1);
    throw err;
  }
}

async function diffAndNotify(
  items: Item[],
  version: string,
): Promise<Awaited<ReturnType<typeof runCatalogNotify>>> {
  const { data: snapRows, error: snapError } = await supabaseAdmin
    .from("catalog_snapshot")
    .select("product_id, name, price_cents, in_stock")
    .limit(10000);
  if (snapError) throw snapError;

  const saveSnapshot = async () => {
    const rows = items.map((i) => ({
      product_id: i.id,
      name: i.name,
      price_cents: i.priceCents,
      in_stock: i.inStock,
      updated_at: new Date().toISOString(),
    }));
    for (let k = 0; k < rows.length; k += 500) {
      const { error } = await supabaseAdmin
        .from("catalog_snapshot")
        .upsert(rows.slice(k, k + 500), { onConflict: "product_id" });
      if (error) throw error;
    }
  };

  // Primeira execução: só grava a base, sem avisar (senão todo o catálogo
  // viraria "produto novo").
  if (!snapRows || snapRows.length === 0) {
    await saveSnapshot();
    return { status: "seeded" };
  }

  const before = new Map(snapRows.map((r) => [r.product_id, r]));
  const diff: CatalogDiff = {
    added: [],
    priceDown: [],
    priceUp: [],
    backInStock: [],
    outOfStock: [],
  };
  for (const item of items) {
    const old = before.get(item.id);
    if (!old) {
      if (item.inStock) diff.added.push(item);
      continue;
    }
    if (item.inStock && old.price_cents !== item.priceCents) {
      (item.priceCents < old.price_cents ? diff.priceDown : diff.priceUp).push({
        item,
        fromCents: old.price_cents,
      });
    }
    if (item.inStock && !old.in_stock) diff.backInStock.push(item);
    if (!item.inStock && old.in_stock) diff.outOfStock.push(item);
  }
  // Maior queda/subida primeiro (é o que mais interessa pra quem revende).
  diff.priceDown.sort(
    (a, b) => b.fromCents - b.item.priceCents - (a.fromCents - a.item.priceCents),
  );
  diff.priceUp.sort((a, b) => b.item.priceCents - b.fromCents - (a.item.priceCents - a.fromCents));

  await saveSnapshot();

  const counts = {
    added: diff.added.length,
    priceDown: diff.priceDown.length,
    priceUp: diff.priceUp.length,
    backInStock: diff.backInStock.length,
    outOfStock: diff.outOfStock.length,
  };
  const stamp = version.slice(0, 8);
  let sent = 0;
  for (const payload of buildNotifications(diff, stamp)) {
    sent += (await sendToAllCustomers(payload)).sent;
  }
  await supabaseAdmin
    .from("catalog_notify_state")
    .update({ last_summary: { ...counts, sent } })
    .eq("id", 1);
  return { status: "notified", diff: counts, sent };
}
