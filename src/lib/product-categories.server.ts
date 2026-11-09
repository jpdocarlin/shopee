// Server-only: banco interno de categorias por produto (tabela
// product_categories, criada em 09/11/2026 a pedido do Jp).
//
// Por quê: descobrir a categoria "na hora" a cada anúncio já errou várias
// vezes (ex.: Hub USB caindo em "Mouses"). Agora cada produto do catálogo tem
// a categoria gravada uma vez e todo mundo usa a mesma:
//   - status "verified": conferida uma a uma antes de gravar;
//   - status "auto": produto novo, resolvido sozinho (sugestão oficial da
//     Shopee conferida pela IA) na primeira vez que alguém escolhe ele.
// Ninguém de fora lê nem grava: a tabela tem RLS ligado e nenhuma policy, só
// o servidor (service role) acessa.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CategoryMarketplace = "shopee" | "mercado-livre";

type Row = { category_id: string; status: string };

// A tabela ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabaseAdmin as any).from("product_categories");

export async function getSavedCategory(
  productId: string,
  marketplace: CategoryMarketplace,
): Promise<{ categoryId: string; status: string } | null> {
  try {
    const { data, error } = await table()
      .select("category_id, status")
      .eq("product_id", productId)
      .eq("marketplace", marketplace)
      .limit(1);
    if (error) throw error;
    const row = (data as Row[] | null)?.[0];
    return row ? { categoryId: row.category_id, status: row.status } : null;
  } catch (err) {
    console.error("[product-categories] falha ao ler:", err);
    return null;
  }
}

// Só grava se ainda não existir — nunca passa por cima de uma categoria já
// gravada (principalmente das "verified").
export async function saveAutoCategory(input: {
  productId: string;
  marketplace: CategoryMarketplace;
  categoryId: string;
  categoryPath: string | null;
  productName: string;
  source: string;
}): Promise<void> {
  try {
    const { error } = await table().upsert(
      {
        product_id: input.productId,
        marketplace: input.marketplace,
        category_id: input.categoryId,
        category_path: input.categoryPath,
        product_name: input.productName.slice(0, 300),
        status: "auto",
        source: input.source,
      },
      { onConflict: "product_id,marketplace", ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch (err) {
    console.error("[product-categories] falha ao gravar:", err);
  }
}
