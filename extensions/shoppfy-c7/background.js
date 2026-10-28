// Shoppfy → C7 (service worker): busca os dados do pedido e a etiqueta fora
// da página da C7 (sem esbarrar em CORS) e devolve pro content script.
const API = "https://www.shoppfy.online/api/c7-handoff";

async function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "handoff") {
        const res = await fetch(`${API}?token=${encodeURIComponent(msg.token)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
        sendResponse({ ok: true, data: json });
      } else if (msg?.type === "label") {
        const res = await fetch(msg.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Não deu pra baixar a etiqueta (${res.status})`);
        const type = res.headers.get("content-type") || "application/pdf";
        sendResponse({ ok: true, base64: await toBase64(await res.arrayBuffer()), type });
      } else {
        sendResponse({ ok: false, error: "Mensagem desconhecida" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true; // resposta assíncrona
});
