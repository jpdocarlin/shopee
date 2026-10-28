// Preço ao vivo da C7Drop (tabela Dropshipping) e registro de pedido com o
// custo conferido no servidor. Ver src/lib/c7drop-price.server.ts.
//
// SECURITY: requireSupabaseAuth. O pedido é gravado com o client do próprio
// usuário (RLS de fulfillment_requests continua valendo) e o custo nunca
// fica abaixo do preço atual da C7Drop — o servidor confere antes de gravar.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PersonType } from "@/lib/fulfillment";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const checkC7DropPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { productId: string }) => {
    const productId = clean(data?.productId, 60);
    if (!productId) throw new Error("Produto inválido.");
    return { productId };
  })
  .handler(async ({ data }) => {
    const { getC7DropLivePrice } = await import("@/lib/c7drop-price.server");
    return getC7DropLivePrice(data.productId);
  });

type SubmitInput = {
  requestId: string;
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
  submitterPersonType: PersonType;
  submitterDocument: string;
  productId: string;
  expectedCostCents: number;
  labelPath: string;
  proofPath: string;
  notes?: string;
  variation?: string;
  quantity?: number;
};

export type SubmitFulfillmentResult =
  | { ok: true; id: string; costCents: number }
  | { ok: false; reason: "price_changed"; priceCents: number }
  | { ok: false; reason: "sold_out" };

export const submitFulfillmentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SubmitInput): SubmitInput => {
    const out: SubmitInput = {
      requestId: clean(data?.requestId, 40),
      submitterName: clean(data?.submitterName, 160),
      submitterEmail: clean(data?.submitterEmail, 160),
      submitterPhone: clean(data?.submitterPhone, 40),
      submitterPersonType: data?.submitterPersonType === "juridica" ? "juridica" : "fisica",
      submitterDocument: clean(data?.submitterDocument, 30),
      productId: clean(data?.productId, 60),
      expectedCostCents: Math.floor(Number(data?.expectedCostCents) || 0),
      labelPath: clean(data?.labelPath, 300),
      proofPath: clean(data?.proofPath, 300),
      notes: clean(data?.notes, 2000),
      variation: clean(data?.variation, 120),
      quantity: Math.min(50, Math.max(1, Math.floor(Number(data?.quantity) || 1))),
    };
    if (!/^[0-9a-f-]{36}$/i.test(out.requestId)) throw new Error("Pedido inválido.");
    if (
      !out.submitterName ||
      !out.submitterEmail ||
      !out.submitterPhone ||
      !out.submitterDocument ||
      !out.productId ||
      !(out.expectedCostCents > 0) ||
      !out.labelPath ||
      !out.proofPath
    ) {
      throw new Error("Preencha todos os campos do pedido.");
    }
    return out;
  })
  .handler(async ({ context, data }): Promise<SubmitFulfillmentResult> => {
    const prefix = `${context.userId}/${data.requestId}/`;
    if (!data.labelPath.startsWith(prefix) || !data.proofPath.startsWith(prefix)) {
      throw new Error("Anexos inválidos. Anexe a etiqueta e o comprovante de novo.");
    }

    const { getC7DropLivePrice } = await import("@/lib/c7drop-price.server");
    const { C7DROP_PRODUCTS } = await import("@/data/c7drop-products");
    const live = await getC7DropLivePrice(data.productId);
    if (!live.available) return { ok: false, reason: "sold_out" };
    // Preço subiu depois que o revendedor viu o valor: não grava, devolve o
    // preço novo pra ele mandar a diferença no PIX.
    // expectedCostCents é o preço da UNIDADE que a pessoa viu.
    if (live.priceCents > data.expectedCostCents) {
      return { ok: false, reason: "price_changed", priceCents: live.priceCents };
    }
    const quantity = data.quantity ?? 1;

    const product = C7DROP_PRODUCTS.find((p) => p.id === data.productId)!;
    const { data: row, error } = await context.supabase
      .from("fulfillment_requests")
      .insert({
        id: data.requestId,
        user_id: context.userId,
        submitter_name: data.submitterName,
        submitter_email: data.submitterEmail,
        submitter_phone: data.submitterPhone,
        submitter_person_type: data.submitterPersonType,
        submitter_document: data.submitterDocument,
        product_name: product.name,
        product_id: product.id,
        product_image_url: product.image,
        // O que o revendedor viu e pagou (nunca menos que o preço atual).
        cost_cents: data.expectedCostCents * quantity,
        label_path: data.labelPath,
        proof_path: data.proofPath,
        notes: data.notes || null,
        variation: data.variation || null,
        quantity,
      } as never)
      .select("id")
      .single();
    if (error) {
      console.error("[submitFulfillmentRequest] falha ao gravar:", error);
      throw new Error("Não deu pra enviar o pedido agora. Tente de novo.");
    }
    return { ok: true, id: row.id, costCents: data.expectedCostCents * quantity };
  });
