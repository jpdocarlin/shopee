import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
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
import { generateEnhancedProductPhoto } from "@/lib/gemini-image.functions";
import { getShopeeStatus } from "@/lib/shopee.functions";
import { getShopeeCategories, publishShopeeProduct } from "@/lib/shopee-product.functions";
import { useIsOwner } from "@/lib/owner";
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
// Sempre Shopee porque é o marketplace que a conta do Jp usa hoje.
function c7dropToDemoProduct(product: C7DropProduct): DemoProduct {
  return {
    id: `c7drop-${product.id}`,
    title: product.name,
    marketplace: "shopee",
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
  const isOwner = useIsOwner();
  const [selected, setSelected] = useState<DemoProduct | null>(null);

  // Preço
  const [costInput, setCostInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [customMarginInput, setCustomMarginInput] = useState("");

  // Textos
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingVariant, setListingVariant] = useState(0);

  // Foto
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Publicar via API oficial da Shopee (só o dono, só enquanto a loja
  // conectada estiver em sandbox — ver Integrações).
  const [shopeeConnected, setShopeeConnected] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  // 04/09/2026: categoria é pré-selecionada automaticamente (ver
  // runShopeeCategories abaixo) — esse toggle só abre a busca manual pra
  // quem quiser testar outra categoria de propósito. Por padrão fica
  // escondido: publicar não deve exigir nenhum clique extra do usuário.
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [stockInput, setStockInput] = useState("10");
  const [weightInput, setWeightInput] = useState("0,3");
  const [publishApiLoading, setPublishApiLoading] = useState(false);
  const [publishApiError, setPublishApiError] = useState<string | null>(null);
  const [publishApiItemId, setPublishApiItemId] = useState<number | null>(null);

  const runListing = useServerFn(generateListing);
  const runPhoto = useServerFn(generateEnhancedProductPhoto);
  const runShopeeStatus = useServerFn(getShopeeStatus);
  const runShopeeCategories = useServerFn(getShopeeCategories);
  const runPublishApi = useServerFn(publishShopeeProduct);

  // Só busca status/categoria pra quem é dono — pra qualquer outro usuário
  // do Shoppfy nem faz sentido chamar (a loja conectada é sempre a do Jp).
  useEffect(() => {
    if (!isOwner) return;
    runShopeeStatus()
      .then((res) => setShopeeConnected(res.connected))
      .catch(() => setShopeeConnected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || shopeeConnected !== true || !selected || selected.marketplace !== "shopee")
      return;
    if (categories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    runShopeeCategories()
      .then((result) => {
        setCategories(result);
        // 04/09/2026: a Shopee EXIGE category_id em todo produto — não dá
        // pra publicar sem categoria (regra da própria plataforma, não
        // nossa). Mas no sandbox a lista vem sem nomes reais (só
        // "Categoria 123456"), então escolher manualmente é praticamente
        // um chute. Pra tirar esse atrito enquanto testamos, pré-seleciona
        // automaticamente a 100021 — já confirmada funcionando ponta a
        // ponta (marca + atributos + publish OK). O usuário ainda pode
        // trocar se quiser testar outra categoria.
        const KNOWN_WORKING_CATEGORY_ID = 100021;
        if (result.some((c) => c.id === KNOWN_WORKING_CATEGORY_ID)) {
          setSelectedCategoryId((prev) => prev ?? KNOWN_WORKING_CATEGORY_ID);
        }
      })
      .catch((err) =>
        setCategoriesError(
          err instanceof Error ? err.message : "Não consegui carregar as categorias.",
        ),
      )
      .finally(() => setCategoriesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, shopeeConnected, selected]);

  const selectProduct = (product: DemoProduct) => {
    setSelected(product);
    // O preço do catálogo é o que você paga no fornecedor — vira o custo.
    setCostInput((product.priceCents / 100).toFixed(2).replace(".", ","));
    setPriceInput("");
    setListing(null);
    setListingError(null);
    setListingVariant(0);
    setPhoto(null);
    setSelectedCategoryId(null);
    setPublishApiError(null);
    setPublishApiItemId(null);
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

  const handleGeneratePhoto = async () => {
    if (!selected) return;
    setPhotoLoading(true);
    try {
      const result = await runPhoto({
        data: {
          title: selected.title,
          category: selected.category,
          productImageUrl: selected.image,
        },
      });
      setPhoto(result.dataUrl);
    } catch (err) {
      console.error("[CriarAnuncio] falha ao gerar foto:", err);
      toast.error("Não deu pra gerar a foto agora", { description: "Tente de novo em instantes." });
    } finally {
      setPhotoLoading(false);
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
      photoDataUrl: photo,
    });

    const publishUrl = MARKETPLACE_PUBLISH_URL[selected.marketplace];
    if (publishTab && !publishTab.closed) {
      publishTab.location.href = publishUrl;
    } else {
      // Bloqueado mesmo assim (raro) — tenta de novo como último recurso.
      window.open(publishUrl, "_blank", "noopener,noreferrer");
    }
  };

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    const list = term ? categories.filter((c) => c.name.toLowerCase().includes(term)) : categories;
    return list.slice(0, 200);
  }, [categories, categorySearch]);

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
    try {
      const result = await runPublishApi({
        data: {
          categoryId: selectedCategoryId,
          itemName: listing.title,
          description: listing.description,
          priceReais: priceCents / 100,
          stock,
          weightKg: weight,
          imageDataUrl: photo,
          imageUrl: selected.image,
        },
      });
      setPublishApiItemId(result.itemId);
      toast.success("Produto publicado na loja Shopee (sandbox)", {
        description: result.itemId ? `item_id ${result.itemId}` : undefined,
      });
    } catch (err) {
      console.error("[CriarAnuncio] falha ao publicar via API:", err);
      setPublishApiError(
        err instanceof Error ? err.message : "Não foi possível publicar pela API agora.",
      );
    } finally {
      setPublishApiLoading(false);
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

        <C7DropProductPicker
          selected={
            selected?.id.startsWith("c7drop-") ? { id: selected.id.replace("c7drop-", "") } : null
          }
          onSelect={(product) => selectProduct(c7dropToDemoProduct(product))}
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
            <Step n={4}>Gere a foto de capa</Step>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              A IA refaz a foto do fornecedor em qualidade de catálogo, mantendo o produto igual —
              fundo limpo, sem marca d&apos;água e sem texto de outra loja.
            </p>

            <div className="flex items-start gap-4">
              <img
                src={photo ?? selected.image}
                alt={selected.title}
                className="size-28 shrink-0 rounded-lg border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleGeneratePhoto}
                    disabled={photoLoading}
                  >
                    {photoLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {photoLoading ? "Gerando…" : photo ? "Gerar outra foto" : "Gerar foto de capa"}
                  </Button>
                  {photo && (
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a href={photo} download={`${selected.id}-anuncio.jpg`}>
                        <Download className="size-3.5" />
                        Baixar foto
                      </a>
                    </Button>
                  )}
                </div>
                {photo && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <Sparkles className="size-3 text-brand" />
                    Foto refeita pela IA
                  </p>
                )}
              </div>
            </div>
          </Reveal>

          {/* Passo 5 — publicar */}
          <Reveal className="surface-card p-5">
            <Step n={5}>Publique na {marketplaceLabel}</Step>

            {isOwner && selected.marketplace === "shopee" && (
              <div className="mb-5 rounded-lg border border-brand/30 bg-brand/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UploadCloud className="size-4 text-brand" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Publicar direto pela API oficial
                  </p>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-500">
                    Sandbox
                  </span>
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
                    <p className="text-[12px] text-muted-foreground">
                      Publica de verdade na loja de teste conectada — ainda não vale pra loja real
                      (falta a Shopee aprovar o app no Go-Live).
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] text-muted-foreground">
                          Categoria na Shopee
                        </label>

                        {!showCategoryPicker ? (
                          <div className="flex h-9 items-center justify-between rounded-md border border-border bg-card px-2.5 text-[13px]">
                            <span className="truncate text-foreground">
                              {categoriesLoading
                                ? "Carregando…"
                                : selectedCategoryId
                                  ? (categories.find((c) => c.id === selectedCategoryId)?.name ??
                                    `Categoria ${selectedCategoryId}`)
                                  : "Nenhuma categoria disponível"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowCategoryPicker(true)}
                              className="ml-2 shrink-0 text-[12px] text-brand underline underline-offset-2"
                            >
                              trocar
                            </button>
                          </div>
                        ) : (
                          <>
                            <Input
                              id="categoria-shopee"
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              placeholder="Buscar categoria…"
                              className="mb-1.5 h-9 text-[13px]"
                              disabled={categoriesLoading || categories.length === 0}
                            />
                            <select
                              value={selectedCategoryId ?? ""}
                              onChange={(e) =>
                                setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)
                              }
                              disabled={categoriesLoading || categories.length === 0}
                              className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] text-foreground disabled:opacity-50"
                            >
                              <option value="">
                                {categoriesLoading ? "Carregando categorias…" : "Selecione…"}
                              </option>
                              {filteredCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
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
                        <p>{categoriesError}</p>
                      </div>
                    )}

                    {publishApiError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <p>{publishApiError}</p>
                      </div>
                    )}

                    {publishApiItemId !== null && (
                      <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-[12px] text-success">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                        <p>Publicado na loja de teste — item_id {publishApiItemId}.</p>
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
                      {publishApiLoading ? "Publicando…" : "Publicar via API (sandbox)"}
                    </Button>
                    {!selectedCategoryId && categories.length > 0 && (
                      <p className="text-[11.5px] text-muted-foreground">
                        Escolha uma categoria acima antes de publicar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="mb-3 text-[12.5px] text-muted-foreground">
              {isOwner
                ? "Prefere fazer manualmente? Copie cada campo abaixo e clique em publicar, que já te levamos direto pra tela de cadastro de produto."
                : "Não conseguimos publicar sozinhos por enquanto — a Shopee só libera isso pra parceiros aprovados. Mas deixamos tudo pronto: copie cada campo abaixo e clique em publicar, que já te levamos direto pra tela de cadastro de produto."}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <QuickCopyRow label="Título" value={listing?.title ?? ""} />
              <QuickCopyRow label="Descrição" value={listing?.description ?? ""} />
              <QuickCopyRow label="Preço de venda" value={priceInput ? `R$ ${priceInput}` : ""} />
              <QuickCopyRow label="Palavras-chave" value={listing?.keywords.join(", ") ?? ""} />
            </div>

            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Não esqueça de anexar a foto que você baixou no passo 4.
            </p>

            <Button
              size="lg"
              className="mt-4 w-full gap-2 sm:w-auto"
              onClick={handlePublish}
              disabled={!listing || !priceInput}
            >
              <ExternalLink className="size-4" />
              Publicar produto na {marketplaceLabel}
            </Button>
            {!listing && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Gere o título e a descrição no passo 3 antes de publicar.
              </p>
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
