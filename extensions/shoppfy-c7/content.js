// Shoppfy → C7 (content script em www.c7drop.com.br)
//
// Fluxo, a partir do botão "Comprar na C7" do Pedidos (Admin):
//   produto  → escolhe Dropshipping, a variação e a quantidade → Adicionar ao carrinho
//   carrinho → confere a embalagem (R$ 1,50) → Finalizar compra
//   checkout → preenche os dados do lojista e anexa a etiqueta → PARA
// Quem confere, clica em continuar e paga é sempre a pessoa. A extensão
// nunca toca em pagamento.
(() => {
  const STATE_KEY = "shoppfyC7";
  const MAX_AGE_MS = 30 * 60 * 1000;

  // ------------------------------------------------------------ utilidades
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (t) =>
    (t || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  async function waitFor(fn, timeout = 15000, every = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) {
        // tenta de novo
      }
      await sleep(every);
    }
    return null;
  }

  function clickables() {
    return [
      ...document.querySelectorAll("button, a, [role=button], label, [tabindex], div, span"),
    ].filter(visible);
  }

  // Elemento clicável com o texto exato (ou começando com ele), o menor possível.
  function findByText(text, { exact = true } = {}) {
    const want = norm(text);
    const matches = clickables().filter((el) => {
      const t = norm(el.innerText || el.getAttribute("aria-label") || el.title);
      return exact ? t === want : t.startsWith(want);
    });
    matches.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
    const pick = matches[0];
    if (!pick) return null;
    return pick.closest("button, a, [role=button], label") || pick;
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter ? setter.call(input, value) : (input.value = value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  const onlyDigits = (s) => (s || "").replace(/\D/g, "");

  // ------------------------------------------------------------- estado
  const getState = () =>
    new Promise((r) => chrome.storage.local.get(STATE_KEY, (v) => r(v[STATE_KEY] || null)));
  const setState = (s) => new Promise((r) => chrome.storage.local.set({ [STATE_KEY]: s }, r));
  const clearState = () => new Promise((r) => chrome.storage.local.remove(STATE_KEY, r));
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

  // -------------------------------------------------------------- painel
  let panel;
  function showPanel(html, tone = "info") {
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "shoppfy-c7-panel";
      Object.assign(panel.style, {
        position: "fixed",
        left: "16px",
        bottom: "16px",
        zIndex: 2147483647,
        maxWidth: "360px",
        padding: "14px 16px",
        borderRadius: "12px",
        font: "13px/1.45 system-ui, -apple-system, sans-serif",
        color: "#fff",
        boxShadow: "0 12px 32px rgba(0,0,0,.35)",
      });
      document.body.appendChild(panel);
    }
    panel.style.background = tone === "error" ? "#b42318" : tone === "done" ? "#067647" : "#1f1f1f";
    panel.style.border = "1px solid " + (tone === "info" ? "#ff6a00" : "transparent");
    panel.innerHTML =
      `<div style="font-weight:700;margin-bottom:4px">Shoppfy → C7</div>` +
      `<div>${html}</div>` +
      `<button id="shoppfy-c7-close" style="margin-top:10px;background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer">` +
      (tone === "info" ? "Cancelar" : "Fechar") +
      `</button>`;
    panel.querySelector("#shoppfy-c7-close").onclick = async () => {
      await clearState();
      panel.remove();
      panel = null;
    };
  }

  async function fail(message) {
    await clearState();
    showPanel(message, "error");
  }

  // ------------------------------------------------------------ etapas
  async function stepProduct(state) {
    const { data } = state;
    showPanel(`Preparando <b>${data.productName}</b>…`);

    // Modo de compra: Dropshipping
    const drop = await waitFor(() => findByText("Dropshipping"));
    if (!drop) return fail("Não achei a opção <b>Dropshipping</b> nessa página.");
    drop.click();
    await sleep(500);

    // Variação (cor etc.)
    if (data.variation) {
      const v = await waitFor(() => findByText(data.variation), 6000);
      if (!v) {
        return fail(
          `Não achei a variação <b>${data.variation}</b>. Escolha manualmente e siga a compra.`,
        );
      }
      v.click();
      await sleep(400);
    }

    // Quantidade: clica no "+" (quantidade − 1) vezes
    const qty = Math.max(1, Number(data.quantity) || 1);
    if (qty > 1) {
      const qtyInput = [...document.querySelectorAll("input")].find(
        (i) => visible(i) && /^\d+$/.test(i.value) && i.value === "1",
      );
      const plus = qtyInput?.parentElement
        ? [...qtyInput.parentElement.querySelectorAll("button")].pop()
        : null;
      if (!plus) return fail("Não achei o campo de quantidade. Ajuste manualmente.");
      for (let i = 1; i < qty; i++) {
        plus.click();
        await sleep(200);
      }
    }

    const add = await waitFor(() => findByText("Adicionar ao carrinho"));
    if (!add) return fail("Não achei o botão <b>Adicionar ao carrinho</b>.");
    await setState({ ...state, stage: "cart" });
    add.click();
    await sleep(1500);
    if (!/\/carrinho/.test(location.pathname)) location.href = "/carrinho";
  }

  async function stepCart(state) {
    showPanel("Conferindo carrinho e embalagem…");
    const finish = await waitFor(() => findByText("Finalizar compra"));
    if (!finish) return fail("Não achei o botão <b>Finalizar compra</b> no carrinho.");

    // Carrinho precisa ter só este pedido.
    const countMatch = (document.body.innerText.match(/(\d+)\s+itens?\b/i) || [])[1];
    const expected = 1;
    if (countMatch && Number(countMatch) > expected) {
      return fail(
        `O carrinho tem <b>${countMatch} itens</b>. Deixe só o produto deste pedido e clique em “Comprar na C7” de novo.`,
      );
    }
    // Embalagem C7 de R$ 1,50
    const txt = norm(document.body.innerText);
    if (!(txt.includes("embalagem") && txt.includes("1,50"))) {
      return fail(
        "Não encontrei a <b>embalagem de R$ 1,50</b> no carrinho. Escolha a embalagem C7 e siga manualmente.",
      );
    }
    await setState({ ...state, stage: "checkout" });
    finish.click();
    await sleep(1500);
    if (!/\/checkout/.test(location.pathname)) location.href = "/checkout";
  }

  async function stepCheckout(state) {
    const s = state.data.submitter;
    showPanel("Preenchendo os dados do lojista…");

    const byPh = (ph) =>
      [...document.querySelectorAll("input")].find(
        (i) => visible(i) && norm(i.placeholder).includes(norm(ph)),
      );
    const nome = await waitFor(() => byPh("Seu nome"));
    if (!nome) return fail("Não achei o formulário de <b>Dados Pessoais</b>.");

    setNativeValue(nome, s.firstName);
    const sobrenome = byPh("Seu sobrenome");
    if (sobrenome) setNativeValue(sobrenome, s.lastName || s.firstName);
    const email = byPh("@");
    if (email) setNativeValue(email, s.email);
    const tel = [...document.querySelectorAll("input[type=tel]")].find(visible) || byPh("(00)");
    if (tel) setNativeValue(tel, onlyDigits(s.phone));

    const tipo = findByText(s.personType === "juridica" ? "Pessoa Jurídica" : "Pessoa Física");
    if (tipo) {
      tipo.click();
      await sleep(400);
    }
    // CPF/CNPJ: o campo de texto visível que vem depois dos botões de tipo de pessoa.
    const doc = await waitFor(() => {
      const inputs = [...document.querySelectorAll("input[type=text], input:not([type])")].filter(
        visible,
      );
      return inputs.find((i) => /cpf|cnpj|000\.000|00\.000/i.test(i.placeholder + " " + i.name));
    }, 3000);
    if (doc) setNativeValue(doc, onlyDigits(s.document));

    // Etiqueta
    if (state.data.label?.url) {
      showPanel("Anexando a etiqueta…");
      const file = await send({ type: "label", url: state.data.label.url });
      if (!file?.ok) return fail(`Não deu pra anexar a etiqueta: ${file?.error || "erro"}.`);
      const bin = atob(file.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const f = new File([bytes], state.data.label.filename || "etiqueta.pdf", { type: file.type });
      const input = document.querySelector("input[type=file]");
      if (!input) return fail("Não achei o campo <b>Anexar etiqueta</b>.");
      const dt = new DataTransfer();
      dt.items.add(f);
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await clearState();
    showPanel(
      `Tudo preenchido para <b>${state.data.productName}</b>` +
        `${state.data.variation ? ` (${state.data.variation})` : ""}` +
        `${Number(state.data.quantity) > 1 ? ` · ${state.data.quantity} un.` : ""}.<br>` +
        `<b>Confira os dados e a etiqueta</b>, depois clique em continuar e faça o pagamento.`,
      "done",
    );
  }

  // ---------------------------------------------------------- orquestração
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      // Início: o botão "Comprar na C7" abre o produto com #shoppfy-c7=<passe>
      const m = location.hash.match(/shoppfy-c7=([0-9a-f]{64})/);
      if (m) {
        history.replaceState(null, "", location.pathname + location.search);
        showPanel("Buscando o pedido na Shoppfy…");
        const res = await send({ type: "handoff", token: m[1] });
        if (!res?.ok) return fail(res?.error || "Não deu pra buscar o pedido.");
        await setState({ stage: "product", data: res.data, startedAt: Date.now() });
      }

      const state = await getState();
      if (!state) return;
      if (Date.now() - state.startedAt > MAX_AGE_MS) return fail("Esse pedido expirou. Clique em “Comprar na C7” de novo.");

      const path = location.pathname;
      if (state.stage === "product" && path.startsWith("/produto/")) await stepProduct(state);
      else if (state.stage === "cart" && path.startsWith("/carrinho")) await stepCart(state);
      else if (state.stage === "checkout" && path.startsWith("/checkout")) await stepCheckout(state);
    } finally {
      running = false;
    }
  }

  // A C7 troca de página sem recarregar: acompanha a URL.
  let lastUrl = "";
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(tick, 800);
    }
  }, 500);
})();
