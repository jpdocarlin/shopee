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
