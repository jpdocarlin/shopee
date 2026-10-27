// Pós-venda — perguntas do Mercado Livre (com resposta sugerida pela IA),
// devoluções dos dois canais e relatório de lucro.
// SECURITY: tudo exige sessão e opera só na loja / nos dados do usuário logado.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------------------------------------------------------- perguntas

export type MlQuestion = {
  id: number;
  text: string;
  itemId: string;
  itemTitle: string;
  itemThumbnail: string | null;
  createdAt: string;
};

export const listMlQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      connected: boolean;
      blocked?: boolean;
      questions: MlQuestion[];
    }> => {
      const { getValidMercadoLivreAccessToken } =
        await import("@/lib/mercadolivre-connection.server");
      const { callMercadoLivreApi } = await import("@/lib/mercadolivre-api.server");
      let accessToken: string;
      try {
        ({ accessToken } = await getValidMercadoLivreAccessToken(context.userId));
      } catch {
        return { connected: false, questions: [] };
      }
      const me = await callMercadoLivreApi<{ id: number }>("/users/me", { accessToken });
      let json: {
        questions?: Array<{ id: number; text: string; item_id: string; date_created: string }>;
      };
      try {
        json = await callMercadoLivreApi("/questions/search", {
          accessToken,
          query: {
            seller_id: me.id,
            status: "UNANSWERED",
            api_version: 4,
            sort_fields: "date_created",
            sort_types: "DESC",
            limit: 50,
          },
        });
      } catch (err) {
        // 403 PolicyAgent = o Mercado Livre não liberou perguntas pra esta
        // conexão (permissão do app ou conexão feita antes da permissão).
        if (/UNAUTHORIZED|PolicyAgent|403/i.test(err instanceof Error ? err.message : "")) {
          return { connected: true, blocked: true, questions: [] };
        }
        throw err;
      }
      const questions = json.questions ?? [];
      const ids = [...new Set(questions.map((q) => q.item_id))];
      const titles = new Map<string, { title: string; thumb: string | null }>();
      if (ids.length > 0) {
        const { mlItemsInfo } = await import("@/lib/channel-items.server");
        for (const it of await mlItemsInfo(accessToken, ids)) {
          titles.set(it.externalId, { title: it.title, thumb: it.imageUrl });
        }
      }
      return {
        connected: true,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          itemId: q.item_id,
          itemTitle: titles.get(q.item_id)?.title ?? q.item_id,
          itemThumbnail: titles.get(q.item_id)?.thumb ?? null,
          createdAt: q.date_created,
        })),
      };
    },
  );

export const suggestMlAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { question: string; itemTitle: string }) => ({
    question: String(data?.question ?? "").slice(0, 1000),
    itemTitle: String(data?.itemTitle ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const { groqText, hasGroq } = await import("@/lib/groq.server");
    if (!hasGroq()) throw new Error("IA de respostas indisponível agora.");
    const { findCatalogProductByName } = await import("@/lib/catalog");
    const product = findCatalogProductByName(data.itemTitle);
    const prompt = [
      "Você responde perguntas de compradores no Mercado Livre em nome de um lojista brasileiro.",
      "Responda em português do Brasil, educado, curto (no máximo 3 frases), sem emoji.",
      "Nunca invente característica que não esteja nos dados do produto. Se não souber, diga que vai",
      "confirmar e convide a pessoa a comprar com tranquilidade. Proibido: telefone, WhatsApp, e-mail,",
      "link ou qualquer contato fora do Mercado Livre (é contra as regras).",
      "Envio: despacho em até 24h úteis após a compra. Comece com 'Olá!' e termine com 'Ficamos à disposição!'.",
      "",
      `PRODUTO: ${data.itemTitle}`,
      product ? `CATEGORIA: ${product.category}` : "",
      `PERGUNTA DO COMPRADOR: ${data.question}`,
      "",
      "Devolva SOMENTE o texto da resposta.",
    ]
      .filter(Boolean)
      .join("\n");
    const r = await groqText(prompt, { maxTokens: 400 });
    return { answer: r.text.trim().slice(0, 1900) };
  });

export const answerMlQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { questionId: number; text: string }) => {
    const text = String(data?.text ?? "").trim();
    const id = Number(data?.questionId);
    if (!Number.isFinite(id) || id <= 0) throw new Error("Pergunta inválida.");
    if (text.length < 2 || text.length > 2000) throw new Error("Resposta vazia ou longa demais.");
    return { questionId: id, text };
  })
  .handler(async ({ context, data }) => {
    const { getValidMercadoLivreAccessToken } =
      await import("@/lib/mercadolivre-connection.server");
    const { callMercadoLivreApi } = await import("@/lib/mercadolivre-api.server");
    const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
    await callMercadoLivreApi("/answers", {
      method: "POST",
      accessToken,
      body: { question_id: data.questionId, text: data.text },
    });
    return { ok: true };
  });

// ------------------------------------------------------------ devoluções

export type ReturnCase = {
  marketplace: "shopee" | "mercado-livre";
  id: string;
  orderId: string | null;
  status: string;
  reason: string | null;
  createdAt: string | null;
};

export const listReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: ReturnCase[] = [];
    const errors: Record<string, string> = {};

    try {
      const { getValidMercadoLivreAccessToken } =
        await import("@/lib/mercadolivre-connection.server");
      const { callMercadoLivreApi } = await import("@/lib/mercadolivre-api.server");
      const { accessToken } = await getValidMercadoLivreAccessToken(context.userId);
      const json = await callMercadoLivreApi<{
        data?: Array<{
          id: number;
          resource_id?: number;
          status?: string;
          reason_id?: string;
          type?: string;
          date_created?: string;
        }>;
      }>("/post-purchase/v1/claims/search", {
        accessToken,
        query: { limit: 30, sort: "date_created:desc" },
      });
      for (const c of json.data ?? []) {
        out.push({
          marketplace: "mercado-livre",
          id: String(c.id),
          orderId: c.resource_id ? String(c.resource_id) : null,
          status: c.status ?? "—",
          reason: c.type ?? c.reason_id ?? null,
          createdAt: c.date_created ?? null,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/não conectad/i.test(msg)) errors["mercado-livre"] = msg.slice(0, 160);
    }

    try {
      const { getValidShopeeAccessToken } = await import("@/lib/shopee-connection.server");
      const { callShopeeApi } = await import("@/lib/shopee-api.server");
      const { accessToken, shopId } = await getValidShopeeAccessToken(context.userId);
      const to = Math.floor(Date.now() / 1000);
      const json = await callShopeeApi<{
        response?: {
          return?: Array<{
            return_sn: string;
            order_sn?: string;
            status?: string;
            reason?: string;
            create_time?: number;
          }>;
        };
      }>("/api/v2/returns/get_return_list", {
        accessToken,
        shopId,
        query: { page_no: 0, page_size: 30, create_time_from: to - 60 * 86400, create_time_to: to },
      });
      for (const r of json.response?.return ?? []) {
        out.push({
          marketplace: "shopee",
          id: r.return_sn,
          orderId: r.order_sn ?? null,
          status: r.status ?? "—",
          reason: r.reason ?? null,
          createdAt: r.create_time ? new Date(r.create_time * 1000).toISOString() : null,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/não conectad/i.test(msg)) errors.shopee = msg.slice(0, 160);
    }

    out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { returns: out, errors };
  });

// -------------------------------------------------------- relatório lucro

export type ProfitReportRow = {
  marketplace: "shopee" | "mercado-livre";
  productName: string;
  quantity: number;
  saleCents: number;
  costCents: number | null;
  orderedAt: string;
};

export const getProfitReportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { days: number }) => ({
    days: [7, 30, 90].includes(Number(data?.days)) ? Number(data.days) : 30,
  }))
  .handler(async ({ context, data }): Promise<ProfitReportRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("marketplace_orders")
      .select(
        "marketplace, product_name, quantity, sale_cents, cost_cents, ordered_at, dismissed_at",
      )
      .eq("user_id", context.userId)
      .gte("ordered_at", since)
      .limit(5000);
    if (error) throw new Error("Não deu pra montar o relatório agora.");
    return (rows ?? [])
      .filter((r) => !r.dismissed_at)
      .map((r) => ({
        marketplace: r.marketplace as ProfitReportRow["marketplace"],
        productName: r.product_name,
        quantity: r.quantity,
        saleCents: r.sale_cents,
        costCents: r.cost_cents,
        orderedAt: r.ordered_at,
      }));
  });
