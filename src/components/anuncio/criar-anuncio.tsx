import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Tags,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { C7DropProductPicker } from "@/components/anuncio/c7drop-product-picker";
import { MARKETPLACE_META, type DemoProduct } from "@/data/demo-products";
import type { C7DropProduct } from "@/data/c7drop-products";
import { formatBRL } from "@/lib/format";
import { requestExtensionPublish } from "@/lib/extension-bridge";
import { calcPricing, suggestPrice } from "@/lib/marketplace-fees";
import { generateListing } from "@/lib/gemini-text.functions";
import { getShopeeStatus } from "@/lib/shopee.functions";
import {
  getShopeeCategories,
  getShopeeItemPreview,
  publishShopeeProduct,
} from "@/lib/shopee-product.functions";
import { pickBestCategory, type ShopeeCategoryOption } from "@/lib/shopee-category-match";
import { getMercadoLivreStatus } from "@/lib/mercadolivre.functions";
import {
  predictMercadoLivreCategory,
  publishMercadoLivreProduct,
} from "@/lib/mercadolivre-product.functions";
import { cn } from "@/lib/utils";

type Listing = { title: string; description: string; keywords: string[] };

const MARGIN_PRESETS = [0.2, 0.3, 0.4, 0.5];
const RECOMMENDED_MARGINS = [0.2, 0.3];

// Embalagem fixa de R$ 2,00 por pedido (mesma regra do fornecedor usada em
// Pedidos). O frete não entra aqui — quem paga o frete é o cliente que
// compra na Shopee/ML, não você.
const PACKAGING_FEE_CENTS = 200;

// Não existe API pública pra publicar produto direto na loja de terceiros
// (a Shopee só libera isso pra parceiros aprovados) — então a gente deixa
// tudo pronto pra copiar e já abre a tela certa de cadastro de produto
// (não a home da Central do Vendedor, e sim o formulário de novo produto).
const MARKETPLACE_PUBLISH_URL: Record<DemoProduct["marketplace"], string> = {
  shopee: "https://seller.shopee.com.br/portal/product/new",
  // Não testei esse fluxo no Mercado Livre ainda — mantive a URL genérica
  // da central do vendedor até validar ao vivo qual é a tela certa de
  // cadastro de produto novo por lá.
  "mercado-livre": "https://www.mercadolivre.com.br/vendas",
};

// Produto da C7Drop (fornecedor de revenda) entra no mesmo fluxo de sempre —
// converte pro formato DemoProduct só com o que os passos 2-5 precisam.
// 16/09/2026: agora aceita o marketplace escolhido (Shopee ou Mercado
// Livre) em vez de fixar sempre Shopee — o Jp pediu pra publicar direto na
// própria loja do Mercado Livre também, igual já funciona pra Shopee.
function c7dropToDemoProduct(
  product: C7DropProduct,
  marketplace: DemoProduct["marketplace"],
): DemoProduct {
  return {
    id: `c7drop-${product.id}`,
    title: product.name,
    marketplace,
    category: product.category,
    seller: "C7Drop (fornecedor)",
    priceCents: product.priceCents,
    originalPriceCents: product.compareAtPriceCents,
    commissionRate: 0,
    rating: 0,
    reviews: 0,
    sales: 0,
    score: 0,
    image: product.image,
    url: `https://www.c7drop.com.br/produto/${product.slug}`,
    fastDelivery: false,
  };
}

// 17/09/2026: identifica a mensagem amigável de "cadastro de vendedor (KYC)
// incompleto na Shopee" (ver comentário em callShopeeApi, shopee-api.server.ts)
// pra mostrar um link direto pro Seller Center — sem isso a pessoa via só o
// texto e precisava lembrar/pesquisar o site sozinha.
function isShopeeKycError(message: string): boolean {
  return /cadastro de vendedor/i.test(message);
}

// Passo numerado, igual ao padrão das outras telas do app.
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
        {n}
      </span>
      <p className="text-[14px] font-medium text-foreground">{children}</p>
    </div>
  );
}

function CopyField({
  label,
  value,
  rows,
  hint,
}: {
  label: string;
  value: string;
  rows: number;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info("Copie manualmente o texto");
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-[11.5px]"
            onClick={copy}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            Copiar
          </Button>
        </div>
      </div>
      <Textarea
        readOnly
        value={value}
        rows={rows}
        className="text-[12.5px] leading-relaxed"
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}

// Linha compacta de campo pra copiar de uma vez, usada no passo de publicar.
function QuickCopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.info("Copie manualmente o texto");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{label}:</span> {value || "—"}
      </span>
      <Copy className="size-3.5 shrink-0" />
    </button>
  );
}

export function CriarAnuncio() {
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  // Marketplace escolhido pra publicar o produto do fornecedor — Shopee ou
  // Mercado Livre. Guardado separado de `selected.marketplace` porque
  // precisa existir mesmo antes de escolher um produto (pro clique no
  // C7DropProductPicker já converter pro marketplace certo).
  const [marketplaceChoice, setMarketplaceChoice] = useState<DemoProduct["marketplace"]>("shopee");

  // Preço
  const [costInput, setCostInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [customMarginInput, setCustomMarginInput] = useState("");

  // Textos
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingVariant, setListingVariant] = useState(0);

  // Publicar via API oficial da Shopee — cada usuário conecta e publica na
  // própria loja (ver Integrações).
  const [shopeeConnected, setShopeeConnected] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<ShopeeCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // 16/09/2026: a categoria não é mais escolhida pelo usuário — muita gente
  // estava tomando violação de anúncio na Shopee por marcar a categoria
  // errada. Agora ela é detectada automaticamente (pickBestCategory, casando
  // o título do produto contra o catálogo real de categorias da Shopee) e
  // fica travada: sem campo de busca, sem "trocar". Ver os dois useEffect
  // abaixo (carregar categorias / recalcular o melhor match).
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState("10");
  const [weightInput, setWeightInput] = useState("0,3");
  const [publishApiLoading, setPublishApiLoading] = useState(false);
  const [publishApiError, setPublishApiError] = useState<string | null>(null);
  const [publishApiItemId, setPublishApiItemId] = useState<number | null>(null);
  const [itemPreview, setItemPreview] = useState<{
    itemId: number;
    name: string;
    status: string;
    priceReais: number | null;
    imageUrl: string | null;
    productUrl: string;
  } | null>(null);
  const [itemPreviewLoading, setItemPreviewLoading] = useState(false);

  // Publicar via API oficial do Mercado Livre — mesmo esquema da Shopee
  // acima, só que a categoria vem do preditor oficial do próprio ML
  // (predictMercadoLivreCategory) em vez de um matcher por palavra-chave
  // escrito à mão, e não tem conceito de "peso" nem de canal de logística
  // pra configurar antes de publicar.
  const [mlConnected, setMlConnected] = useState<boolean | null>(null);
  const [mlCategory, setMlCategory] = useState<{ categoryId: string; categoryName: string } | null>(
    null,
  );
  const [mlCategoryLoading, setMlCategoryLoading] = useState(false);
  const [mlCategoryError, setMlCategoryError] = useState<string | null>(null);
  const [mlPublishLoading, setMlPublishLoading] = useState(false);
  const [mlPublishError, setMlPublishError] = useState<string | null>(null);
  const [mlPublishItemId, setMlPublishItemId] = useState<string | null>(null);
  const [mlPublishPermalink, setMlPublishPermalink] = useState<string | null>(null);

  const runListing = useServerFn(generateListing);
  const runShopeeStatus = useServerFn(getShopeeStatus);
  const runShopeeCategories = useServerFn(getShopeeCategories);
  const runPublishApi = useServerFn(publishShopeeProduct);
  const runItemPreview = useServerFn(getShopeeItemPreview);
  const runMlStatus = useServerFn(getMercadoLivreStatus);
  const runMlPredictCategory = useServerFn(predictMercadoLivreCategory);
  const runMlPublish = useServerFn(publishMercadoLivreProduct);

  useEffect(() => {
    runShopeeStatus()
      .then((res) => setShopeeConnected(res.connected))
      .catch(() => setShopeeConnected(false));
  }, []);

  useEffect(() => {
    runMlStatus()
      .then((res) => setMlConnected(res.connected))
      .catch(() => setMlConnected(false));
  }, []);

  useEffect(() => {
    if (shopeeConnected !== true || !selected || selected.marketplace !== "shopee")
      return;
    if (categories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    runShopeeCategories()
      .then((result) => setCategories(result))
      .catch((err) =>
        setCategoriesError(
          err instanceof Error ? err.message : "Não consegui carregar as categorias.",
        ),
      )
      .finally(() => setCategoriesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopeeConnected, selected]);

  // A Shopee EXIGE category_id em todo produto (regra da própria plataforma)
  // — e escolher errado é exatamente o que estava gerando violação de
  // anúncio pra muita gente. Em vez de deixar o usuário escolher (ou fixar
  // uma categoria só pra todo mundo), recalcula automaticamente a categoria
  // que melhor casa com o título do produto sempre que o produto muda ou a
  // lista de categorias termina de carregar. Sem match confiável, fica sem
  // categoria (null) — o botão de publicar já trava nesse caso, é melhor
  // não publicar do que publicar na categoria errada.
  useEffect(() => {
    if (!selected || categories.length === 0) {
      setSelectedCategoryId(null);
      return;
    }
    const match = pickBestCategory(
      { title: selected.title, category: selected.category },
      categories,
    );
    setSelectedCategoryId(match ? match.id : null);
  }, [selected, categories]);

  // Mesma lógica acima, só que pro Mercado Livre — em vez de casar contra
  // uma lista de categorias baixada inteira, chama o preditor oficial do ML
  // (domain_discovery) direto com o título do produto. Sem resultado
  // confiável, fica sem categoria (null) — publicar trava, mesma filosofia
  // da Shopee.
  useEffect(() => {
    if (mlConnected !== true || !selected || selected.marketplace !== "mercado-livre") return;
    setMlCategoryLoading(true);
    setMlCategoryError(null);
    setMlCategory(null);
    runMlPredictCategory({ data: { title: selected.title } })
      .then((result) =>
        setMlCategory(
          result ? { categoryId: result.categoryId, categoryName: result.categoryName } : null,
        ),
      )
      .catch((err) =>
        setMlCategoryError(
          err instanceof Error ? err.message : "Não consegui identificar a categoria certa.",
        ),
      )
      .finally(() => setMlCategoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mlConnected, selected]);

  const selectProduct = (product: DemoProduct) => {
    setSelected(product);
    // O preço do catálogo é o que você paga no fornecedor — vira o custo.
    setCostInput((product.priceCents / 100).toFixed(2).replace(".", ","));
    setPriceInput("");
    setListing(null);
    setListingError(null);
    setListingVariant(0);
    setSelectedCategoryId(null);
    setPublishApiError(null);
    setPublishApiItemId(null);
    setMlCategory(null);
    setMlPublishError(null);
    setMlPublishItemId(null);
    setMlPublishPermalink(null);
  };

  // Troca de marketplace (Shopee ↔ Mercado Livre) — vale tanto pra próxima
  // escolha no C7DropProductPicker quanto pro produto já selecionado (a
  // categoria detectada é específica de cada marketplace, então zera os dois
  // lados ao trocar).
  const handleMarketplaceChange = (marketplace: DemoProduct["marketplace"]) => {
    setMarketplaceChoice(marketplace);
    setSelected((prev) => (prev ? { ...prev, marketplace } : prev));
    setSelectedCategoryId(null);
    setPublishApiError(null);
    setPublishApiItemId(null);
    setMlCategory(null);
    setMlPublishError(null);
    setMlPublishItemId(null);
    setMlPublishPermalink(null);
  };

  const parseMoney = (value: string): number => {
    const normalized = value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  };

  const costCents = parseMoney(costInput);
  const priceCents = parseMoney(priceInput);

  const pricing = useMemo(
    () =>
      selected && priceCents > 0
        ? calcPricing(selected.marketplace, costCents, priceCents, PACKAGING_FEE_CENTS)
        : null,
    [selected, costCents, priceCents],
  );

  const applyMargin = (margin: number) => {
    if (!selected || costCents <= 0) return;
    const suggested = suggestPrice(selected.marketplace, costCents, margin, PACKAGING_FEE_CENTS);
    setPriceInput((suggested / 100).toFixed(2).replace(".", ","));
  };

  const applyCustomMargin = () => {
    const parsed = Number.parseFloat(customMarginInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    applyMargin(parsed / 100);
  };

  const handleGenerateListing = async () => {
    if (!selected) return;
    setListingLoading(true);
    setListingError(null);
    try {
      const result = await runListing({
        data: {
          productTitle: selected.title,
          category: selected.category,
          marketplace: selected.marketplace,
          variant: listingVariant,
        },
      });
      setListing(result);
      setListingVariant((v) => v + 1);
    } catch (err) {
      setListingError(
        err instanceof Error ? err.message : "Não foi possível gerar o anúncio agora.",
      );
    } finally {
      setListingLoading(false);
    }
  };

  const marketplaceLabel = selected ? MARKETPLACE_META[selected.marketplace].label : "";

  const handlePublish = async () => {
    if (!selected || !listing) return;

    // Abre a aba em branco JÁ, de forma síncrona, ainda dentro do clique do
    // usuário — navegadores só permitem `window.open` sem bloqueio de popup
    // quando ele roda na mesma pilha síncrona do gesto do usuário. Se a
    // gente esperasse o `await` abaixo (extensão confirmar que gravou os
    // dados) pra só então chamar `window.open`, o Chrome trata como uma
    // chamada "fora do gesto do usuário" e bloqueia a aba silenciosamente
    // (foi o que aconteceu quando adicionamos o `await` sem essa aba em
    // branco antes). Depois, com os dados já prontos, só trocamos a URL
    // dessa aba já aberta — isso não exige um gesto novo.
    //
    // IMPORTANTE: sem "noopener" aqui de propósito — com "noopener" o
    // `window.open` sempre retorna `null` (é assim que o navegador funciona),
    // então a gente nunca teria uma referência pra essa aba e nunca
    // conseguiria navegá-la depois — ela ficava presa em about:blank pra
    // sempre (foi exatamente esse o bug). Em vez disso, zera `.opener`
    // manualmente logo abaixo, o que dá a mesma proteção contra a aba nova
    // "puxar" a original de volta, sem perder a referência.
    const publishTab = window.open("about:blank", "_blank");
    if (publishTab) publishTab.opener = null;

    try {
      await navigator.clipboard.writeText(listing.title);
      toast.success("Título copiado", {
        description: "Cole no primeiro campo — descrição e preço também têm botão de copiar.",
      });
    } catch {
      // Sem permissão de clipboard: sem problema, dá pra copiar cada campo manualmente lá embaixo.
    }
    // Se a extensão Shopfy estiver instalada, ela recebe esses dados e já
    // deixa o campo Nome do Produto preenchido sozinho na tela que vamos
    // abrir a seguir, com o resto num painel flutuante pronto pra copiar.
    // Espera a extensão confirmar que já gravou os dados antes de navegar a
    // aba pra Shopee — senão a aba pode carregar mais rápido que a gravação
    // e não achar nada pendente (a Promise resolve rápido sozinha se não
    // tiver extensão instalada, então não trava o fluxo de ninguém).
    await requestExtensionPublish({
      title: listing.title,
      description: listing.description,
      keywords: listing.keywords,
      priceLabel: priceCents > 0 ? formatBRL(priceCents) : "",
      photoDataUrl: null,
    });

    const publishUrl = MARKETPLACE_PUBLISH_URL[selected.marketplace];
    if (publishTab && !publishTab.closed) {
      publishTab.location.href = publishUrl;
    } else {
      // Bloqueado mesmo assim (raro) — tenta de novo como último recurso.
      window.open(publishUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handlePublishViaApi = async () => {
    if (!selected || !listing || !selectedCategoryId || priceCents <= 0) return;

    const stock = Number.parseInt(stockInput, 10);
    const weight = Number.parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(stock) || stock <= 0) {
      setPublishApiError("Informe um estoque válido (número inteiro maior que 0).");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      setPublishApiError("Informe um peso válido em kg (ex: 0,3).");
      return;
    }

    setPublishApiLoading(true);
    setPublishApiError(null);
    setPublishApiItemId(null);
    setItemPreview(null);
    try {
      const result = await runPublishApi({
        data: {
          categoryId: selectedCategoryId,
          itemName: listing.title,
          description: listing.description,
          priceReais: priceCents / 100,
          stock,
          weightKg: weight,
          imageDataUrl: null,
          imageUrl: selected.image,
          productUrl: selected.url,
        },
      });
      setPublishApiItemId(result.itemId);
      toast.success("Produto publicado na loja Shopee", {
        description: result.itemId ? `item_id ${result.itemId}` : undefined,
      });

      // Busca os dados reais do anúncio (foto/título/preço/status) direto na
      // Shopee, já que o sandbox não tem vitrine navegável — assim dá pra
      // conferir na hora que ficou como esperado, sem precisar sair do app.
      if (result.itemId) {
        setItemPreview(null);
        setItemPreviewLoading(true);
        try {
          const preview = await runItemPreview({ data: { itemId: result.itemId } });
          setItemPreview(preview);
        } catch (previewErr) {
          console.error("[CriarAnuncio] falha ao buscar preview do anúncio:", previewErr);
        } finally {
          setItemPreviewLoading(false);
        }
      }
    } catch (err) {
      console.error("[CriarAnuncio] falha ao publicar via API:", err);
      setPublishApiError(
        err instanceof Error ? err.message : "Não foi possível publicar pela API agora.",
      );
    } finally {
      setPublishApiLoading(false);
    }
  };

  const handlePublishViaMercadoLivre = async () => {
    if (!selected || !listing || !mlCategory || priceCents <= 0) return;

    const stock = Number.parseInt(stockInput, 10);
    if (!Number.isFinite(stock) || stock <= 0) {
      setMlPublishError("Informe um estoque válido (número inteiro maior que 0).");
      return;
    }

    setMlPublishLoading(true);
    setMlPublishError(null);
    setMlPublishItemId(null);
    setMlPublishPermalink(null);
    try {
      const result = await runMlPublish({
        data: {
          categoryId: mlCategory.categoryId,
          itemName: listing.title,
          description: listing.description,
          priceReais: priceCents / 100,
          stock,
          imageUrl: selected.image,
          productUrl: selected.url,
        },
      });
      setMlPublishItemId(result.itemId);
      setMlPublishPermalink(result.permalink);
      toast.success("Produto publicado no Mercado Livre", {
        description: result.itemId ? `item ${result.itemId}` : undefined,
      });
    } catch (err) {
      console.error("[CriarAnuncio] falha ao publicar no Mercado Livre:", err);
      setMlPublishError(
        err instanceof Error ? err.message : "Não foi possível publicar pela API agora.",
      );
    } finally {
      setMlPublishLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      <Reveal className="surface-card p-5">
        <Step n={1}>Escolha o produto que você vai revender</Step>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          O preço do catálogo entra como o seu <span className="text-foreground">custo</span> — é o
          que você paga no fornecedor. Você define por quanto vai revender no passo 2.
        </p>

        <div className="mb-4 flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Publicar em:</span>
          {(["shopee", "mercado-livre"] as const).map((mp) => (
            <button
              key={mp}
              type="button"
              onClick={() => handleMarketplaceChange(mp)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                marketplaceChoice === mp
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground",
              )}
            >
              {MARKETPLACE_META[mp].label}
            </button>
          ))}
        </div>

        <C7DropProductPicker
          selected={
            selected?.id.startsWith("c7drop-") ? { id: selected.id.replace("c7drop-", "") } : null
          }
          onSelect={(product) => selectProduct(c7dropToDemoProduct(product, marketplaceChoice))}
        />
      </Reveal>

      {selected && (
        <>
          {/* Passo 2 — preço */}
          <Reveal className="surface-card p-5">
            <Step n={2}>Defina o seu preço de venda</Step>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="custo">
                  Custo do produto
                </label>
                <Input
                  id="custo"
                  inputMode="decimal"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="preco">
                  Seu preço de venda
                </label>
                <Input
                  id="preco"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              O frete fica por conta de quem compra — não entra na sua conta. Já incluímos{" "}
              {formatBRL(PACKAGING_FEE_CENTS)} de embalagem em cima do seu custo.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Sugerir preço com lucro de</span>
              {MARGIN_PRESETS.map((margin) => (
                <button
                  key={margin}
                  type="button"
                  onClick={() => applyMargin(margin)}
                  disabled={costCents <= 0}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] transition-colors disabled:opacity-40",
                    RECOMMENDED_MARGINS.includes(margin)
                      ? "border-brand/40 text-brand hover:bg-brand/10"
                      : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {Math.round(margin * 100)}%
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <Input
                  inputMode="decimal"
                  value={customMarginInput}
                  onChange={(e) => setCustomMarginInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCustomMargin()}
                  placeholder="Outro %"
                  disabled={costCents <= 0}
                  className="h-7 w-20 text-[12px]"
                />
                <button
                  type="button"
                  onClick={applyCustomMargin}
                  disabled={costCents <= 0 || !customMarginInput}
                  className="rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Você escolhe a margem que quiser — recomendamos entre 20% e 30% de lucro.
            </p>

            {pricing && (
              <div className="mt-4 rounded-lg border border-border bg-surface-hover/50 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">Você recebe</p>
                    <p className="text-[15px] font-semibold tabular-nums text-foreground">
                      {formatBRL(pricing.priceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">Taxa {marketplaceLabel}</p>
                    <p className="text-[15px] font-semibold tabular-nums text-destructive">
                      − {formatBRL(pricing.feeCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">
                      Custo do produto + embalagem
                    </p>
                    <p className="text-[15px] font-semibold tabular-nums text-destructive">
                      − {formatBRL(pricing.costCents + PACKAGING_FEE_CENTS)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">Sobra pra você</p>
                    <p
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        pricing.profitCents >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatBRL(pricing.profitCents)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Faixa de comissão: {pricing.tier.label} ({Math.round(pricing.tier.rate * 100)}% +{" "}
                  {formatBRL(pricing.tier.fixedCents)} por item) · Margem{" "}
                  <span
                    className={cn(
                      "font-medium",
                      pricing.profitCents >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {(pricing.marginPct * 100).toFixed(1)}%
                  </span>
                </p>

                {pricing.profitCents < 0 && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <p>
                      Nesse preço você sai no prejuízo. Suba o preço de venda ou procure um custo
                      menor.
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Taxas de 2026. Marketplace muda tabela de tempos em tempos — confira no painel de
              vendedor antes de publicar. Impostos não estão inclusos nessa conta.
            </p>
          </Reveal>

          {/* Passo 3 — textos */}
          <Reveal className="surface-card p-5">
            <Step n={3}>Gere o texto do anúncio</Step>

            <Button className="gap-2" onClick={handleGenerateListing} disabled={listingLoading}>
              {listingLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : listing ? (
                <RefreshCw className="size-4" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {listingLoading
                ? "Escrevendo…"
                : listing
                  ? "Gerar outra versão"
                  : "Gerar título e descrição"}
            </Button>

            {listingError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{listingError}</p>
              </div>
            )}

            {listing && (
              <div className="mt-4 space-y-4">
                <CopyField
                  label="Título do anúncio"
                  value={listing.title}
                  rows={2}
                  hint={`${listing.title.length}/${selected.marketplace === "shopee" ? 120 : 60} caracteres`}
                />
                <CopyField label="Descrição" value={listing.description} rows={12} />
                {listing.keywords.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Tags className="size-3.5 text-brand" />
                      <p className="text-[12.5px] font-medium text-foreground">
                        Palavras-chave pra busca
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      Espalhe esses termos no título e na descrição — é assim que o anúncio aparece
                      na busca.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Reveal>

          {/* Passo 4 — foto */}
          <Reveal className="surface-card p-5">
            <Step n={4}>Foto do anúncio</Step>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Publicamos com a foto real do fornecedor (mais a galeria completa do produto) — sem
              recriar por IA, pra evitar violação por foto que não bate com o que chega pro cliente.
            </p>

            <div className="flex items-center gap-4">
              <img
                src={selected.image}
                alt={selected.title}
                className="size-28 shrink-0 rounded-lg border border-border object-cover"
              />
              <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
                Essa é a foto de capa que vai pro anúncio. As demais fotos da galeria do produto
                são enviadas junto automaticamente na publicação.
              </p>
            </div>
          </Reveal>

          {/* Passo 5 — publicar */}
          <Reveal className="surface-card p-5">
            <Step n={5}>Publique na {marketplaceLabel}</Step>

            {selected.marketplace === "shopee" && (
              <div className="mb-5 rounded-lg border border-brand/30 bg-brand/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UploadCloud className="size-4 text-brand" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Publicar direto pela API oficial
                  </p>

                </div>

                {shopeeConnected === null && (
                  <p className="text-[12.5px] text-muted-foreground">Verificando conexão…</p>
                )}

                {shopeeConnected === false && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Conecte sua loja Shopee em{" "}
                    <a href="/integracoes" className="text-brand underline underline-offset-2">
                      Integrações
                    </a>{" "}
                    pra publicar direto por aqui, sem copiar nada.
                  </p>
                )}

                {shopeeConnected === true && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] text-muted-foreground">
                          Categoria na Shopee
                        </label>
                        <div className="flex h-9 items-center rounded-md border border-border bg-card px-2.5 text-[13px]">
                          <span className="truncate text-foreground">
                            {categoriesLoading
                              ? "Carregando…"
                              : selectedCategoryId
                                ? (categories.find((c) => c.id === selectedCategoryId)?.path ??
                                  `Categoria ${selectedCategoryId}`)
                                : "Não identificamos a categoria certa pra esse produto"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Detectada automaticamente pelo produto — não dá pra trocar, é assim que
                          evitamos anúncio marcado com categoria errada.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            className="mb-1.5 block text-[12px] text-muted-foreground"
                            htmlFor="estoque"
                          >
                            Estoque
                          </label>
                          <Input
                            id="estoque"
                            inputMode="numeric"
                            value={stockInput}
                            onChange={(e) => setStockInput(e.target.value)}
                            className="h-9 text-[13px]"
                          />
                        </div>
                        <div>
                          <label
                            className="mb-1.5 block text-[12px] text-muted-foreground"
                            htmlFor="peso"
                          >
                            Peso (kg)
                          </label>
                          <Input
                            id="peso"
                            inputMode="decimal"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            className="h-9 text-[13px]"
                          />
                        </div>
                      </div>
                    </div>

                    {categoriesError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <div className="space-y-1.5">
                          <p>{categoriesError}</p>
                          {isShopeeKycError(categoriesError) && (
                            <a
                              href="https://seller.shopee.com.br"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                            >
                              Abrir Seller Center da Shopee
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {publishApiError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <div className="space-y-1.5">
                          <p>{publishApiError}</p>
                          {isShopeeKycError(publishApiError) && (
                            <a
                              href="https://seller.shopee.com.br"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                            >
                              Abrir Seller Center da Shopee
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {publishApiItemId !== null && (
                      <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-[12px] text-success">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                        <p>Publicado na Shopee — item_id {publishApiItemId}.</p>
                      </div>
                    )}

                    {publishApiItemId !== null && (itemPreviewLoading || itemPreview) && (
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                        {itemPreviewLoading ? (
                          <>
                            <div className="size-14 shrink-0 animate-pulse rounded-md bg-muted" />
                            <p className="text-[12px] text-muted-foreground">
                              Buscando o anúncio direto na Shopee…
                            </p>
                          </>
                        ) : itemPreview ? (
                          <>
                            {itemPreview.imageUrl ? (
                              <img
                                src={itemPreview.imageUrl}
                                alt={itemPreview.name}
                                className="size-14 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                                sem foto
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] text-foreground">
                                {itemPreview.name}
                              </p>
                              <p className="text-[11.5px] text-muted-foreground">
                                {itemPreview.priceReais !== null
                                  ? formatBRL(Math.round(itemPreview.priceReais * 100))
                                  : "—"}{" "}
                                · status: {itemPreview.status}
                              </p>
                            </div>
                            <a
                              href={itemPreview.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 flex shrink-0 items-center gap-1 text-[12px] text-brand underline underline-offset-2"
                            >
                              Ver na Shopee
                              <ExternalLink className="size-3" />
                            </a>
                          </>
                        ) : null}
                      </div>
                    )}

                    <Button
                      className="gap-2"
                      onClick={handlePublishViaApi}
                      disabled={
                        publishApiLoading ||
                        !listing ||
                        !priceInput ||
                        !selectedCategoryId ||
                        categoriesLoading
                      }
                    >
                      {publishApiLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UploadCloud className="size-4" />
                      )}
                      {publishApiLoading ? "Publicando…" : "Publicar via API"}
                    </Button>
                    {!selectedCategoryId && categories.length > 0 && (
                      <p className="text-[11.5px] text-muted-foreground">
                        Não conseguimos identificar a categoria certa desse produto pra publicar
                        com segurança — tente outro produto do catálogo.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {selected.marketplace === "mercado-livre" && (
              <div className="mb-5 rounded-lg border border-brand/30 bg-brand/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UploadCloud className="size-4 text-brand" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Publicar direto pela API oficial
                  </p>
                </div>

                {mlConnected === null && (
                  <p className="text-[12.5px] text-muted-foreground">Verificando conexão…</p>
                )}

                {mlConnected === false && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Conecte sua loja Mercado Livre em{" "}
                    <a href="/integracoes" className="text-brand underline underline-offset-2">
                      Integrações
                    </a>{" "}
                    pra publicar direto por aqui, sem copiar nada.
                  </p>
                )}

                {mlConnected === true && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] text-muted-foreground">
                          Categoria no Mercado Livre
                        </label>
                        <div className="flex h-9 items-center rounded-md border border-border bg-card px-2.5 text-[13px]">
                          <span className="truncate text-foreground">
                            {mlCategoryLoading
                              ? "Carregando…"
                              : mlCategory
                                ? mlCategory.categoryName
                                : "Não identificamos a categoria certa pra esse produto"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Detectada automaticamente pelo preditor oficial do Mercado Livre a
                          partir do título — não dá pra trocar, mesmo motivo da Shopee.
                        </p>
                      </div>
                      <div>
                        <label
                          className="mb-1.5 block text-[12px] text-muted-foreground"
                          htmlFor="estoque-ml"
                        >
                          Estoque
                        </label>
                        <Input
                          id="estoque-ml"
                          inputMode="numeric"
                          value={stockInput}
                          onChange={(e) => setStockInput(e.target.value)}
                          className="h-9 text-[13px]"
                        />
                      </div>
                    </div>

                    {mlCategoryError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <p>{mlCategoryError}</p>
                      </div>
                    )}

                    {mlPublishError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <p>{mlPublishError}</p>
                      </div>
                    )}

                    {mlPublishItemId !== null && (
                      <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-[12px] text-success">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span>Publicado no Mercado Livre — item {mlPublishItemId}.</span>
                          {mlPublishPermalink && (
                            <a
                              href={mlPublishPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 underline underline-offset-2"
                            >
                              Ver anúncio
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </p>
                      </div>
                    )}

                    <Button
                      className="gap-2"
                      onClick={handlePublishViaMercadoLivre}
                      disabled={
                        mlPublishLoading ||
                        !listing ||
                        !priceInput ||
                        !mlCategory ||
                        mlCategoryLoading
                      }
                    >
                      {mlPublishLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UploadCloud className="size-4" />
                      )}
                      {mlPublishLoading ? "Publicando…" : "Publicar via API"}
                    </Button>
                    {!mlCategory && !mlCategoryLoading && (
                      <p className="text-[11.5px] text-muted-foreground">
                        Não conseguimos identificar a categoria certa desse produto pra publicar
                        com segurança — tente outro produto do catálogo.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          </Reveal>
        </>
      )}

      {!selected && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3.5 text-[12.5px] text-muted-foreground">
          <Sparkles className="size-4 text-brand" />
          Selecione um produto acima pra montar o anúncio.
        </div>
      )}
    </div>
  );
}
