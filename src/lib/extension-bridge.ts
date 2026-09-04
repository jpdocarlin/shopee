// Bridge com a extensão Shoppfy pra Chrome — a extensão injeta um content
// script nesta origem e conversa com a página via window.postMessage (nunca
// via localStorage direto, pra não depender do formato interno da store).
// Quando a extensão consegue o link de afiliado automaticamente na Shopee,
// ela manda { source: "fornecefy-extension", type: "SAVE_LINK", payload }
// e a gente salva direto na store — sem copiar/colar nada.
import { useEffect } from "react";
import { toast } from "sonner";

import { useAffiliateStore, type Marketplace } from "@/stores/affiliate-store";

const INCOMING_SOURCE = "fornecefy-extension";
const OUTGOING_SOURCE = "fornecefy-app";

type IncomingPayload = {
  productId?: string;
  title: string;
  url: string;
  marketplace?: Marketplace;
  image?: string;
  productUrl?: string;
};

type IncomingMessage = {
  source: typeof INCOMING_SOURCE;
  type: "SAVE_LINK";
  payload: IncomingPayload;
};

function isIncomingMessage(data: unknown): data is IncomingMessage {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate.source === INCOMING_SOURCE &&
    candidate.type === "SAVE_LINK" &&
    typeof candidate.payload === "object" &&
    candidate.payload !== null
  );
}

function makeAdHocId(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return `ext-${Math.abs(hash).toString(36)}`;
}

export type PublishRequestPayload = {
  title: string;
  description: string;
  keywords: string[];
  priceLabel: string;
  /** Data URL (base64) da foto gerada pela IA, se já tiver sido gerada. */
  photoDataUrl?: string | null;
};

/**
 * Manda os dados do anúncio pra extensão, antes de abrir a tela de "Novo
 * Produto" da Shopee — o content script `shopee-new-product.js` lê isso via
 * chrome.storage.local e preenche o campo Nome do Produto sozinho, deixando
 * o resto pronto pra copiar num painel flutuante. Não faz nada se a extensão
 * não estiver instalada (a página só ignora a mensagem).
 *
 * Retorna uma Promise que só resolve depois que a extensão confirma (via
 * PUBLISH_REQUEST_ACK) que já gravou os dados em chrome.storage.local — isso
 * existe pra evitar uma corrida: `chrome.storage.local.set` é assíncrono, e
 * se a gente chamasse `window.open` pra Shopee logo em seguida sem esperar,
 * a aba nova podia carregar e consultar o storage ANTES da gravação
 * terminar, achando "nada pendente" e não preenchendo nada. Se a extensão
 * não estiver instalada, ninguém responde o ACK — por isso tem um timeout
 * curto de fallback, pra não travar o botão de publicar pra sempre.
 */
export function requestExtensionPublish(payload: PublishRequestPayload): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleAck);
      window.clearTimeout(timeoutId);
      resolve();
    };

    function handleAck(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source === INCOMING_SOURCE && data?.type === "PUBLISH_REQUEST_ACK") {
        settle();
      }
    }

    window.addEventListener("message", handleAck);
    // Extensão não instalada (ou lenta) — não trava o fluxo de publicação.
    const timeoutId = window.setTimeout(settle, 1200);

    window.postMessage({ source: OUTGOING_SOURCE, type: "PUBLISH_REQUEST", payload }, "*");
  });
}

/**
 * Monta o listener de mensagens da extensão. Deve ser chamado uma única vez,
 * perto da raiz do app (ver AppShell).
 */
export function useExtensionBridge() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Só aceita mensagens da própria página (o content script do Chrome
      // roda no mesmo "world" da página e usa window.postMessage(..., "*")).
      if (event.source !== window) return;
      if (!isIncomingMessage(event.data)) return;

      const { payload } = event.data;
      if (!payload.url || !payload.title) return;

      const marketplace = payload.marketplace ?? "shopee";
      const productId = payload.productId ?? makeAdHocId(payload.title);

      useAffiliateStore.getState().saveLink(productId, payload.url, {
        title: payload.title,
        marketplace,
        image: payload.image,
        productUrl: payload.productUrl,
      });

      toast.success("Link de afiliado salvo automaticamente", {
        description: payload.title,
      });

      window.postMessage(
        { source: OUTGOING_SOURCE, type: "SAVE_LINK_ACK", productId, url: payload.url },
        "*",
      );
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
}
