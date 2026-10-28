import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Megaphone, Pause, Play, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCatalogProductById } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import {
  getManualListingsExtra,
  listMyListings,
  reviewListingCost,
  setListingActive,
  syncMyListings,
  updateListingPrice,
  type MyListing,
} from "@/lib/listings.functions";
import { calcPricing, suggestPrice } from "@/lib/marketplace-fees";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Todos os seus anúncios da Shopee e do Mercado Livre, com preço, custo, taxa e quanto sobra de lucro.";

// Mesma embalagem fixa do Criar Anúncio.
const PACKAGING_FEE_CENTS = 200;

export const Route = createFileRoute("/_shell/anuncios")({
  head: () => ({
    meta: [{ title: "Meus anúncios · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: AnunciosPage,
});

const CHANNEL_LABEL = { shopee: "Shopee", "mercado-livre": "Mercado Livre" } as const;
const STATUS_LABEL = { active: "Ativo", paused: "Pausado", closed: "Encerrado" } as const;

type ChannelFilter = "all" | "shopee" | "mercado-livre";
type StatusFilter = "all" | "active" | "paused" | "closed";

function parseMoney(v: string): number {
  const n = Number.parseFloat(
    v
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function currentCost(l: MyListing): number | null {
  const product = findCatalogProductById(l.productId);
  return product?.priceCents ?? l.costCents;
}

function ListingRow({ listing, onChanged }: { listing: MyListing; onChanged: () => void }) {
  const [priceInput, setPriceInput] = useState(
    (listing.priceCents / 100).toFixed(2).replace(".", ","),
  );
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const priceCents = parseMoney(priceInput);
  const cost = currentCost(listing);
  const pricing =
    cost !== null && priceCents > 0
      ? calcPricing(listing.marketplace, cost, priceCents, PACKAGING_FEE_CENTS)
      : null;
  const costChanged = cost !== null && listing.costCents !== null && cost !== listing.costCents;
  const dirty = priceCents > 0 && priceCents !== listing.priceCents;

  const savePrice = async () => {
    setSaving(true);
    try {
      await updateListingPrice({ data: { id: listing.id, priceCents } });
      toast.success("Preço atualizado no canal");
      onChanged();
    } catch (err) {
      toast.error("Não deu pra mudar o preço", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    setToggling(true);
    try {
      await setListingActive({ data: { id: listing.id, active: listing.status !== "active" } });
      toast.success(listing.status === "active" ? "Anúncio pausado" : "Anúncio reativado");
      onChanged();
    } catch (err) {
      toast.error("Não deu pra mudar o status", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.6fr)_160px_minmax(0,1.2fr)_150px] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-md bg-surface-hover object-cover"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-md bg-surface-hover" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
            {listing.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-medium",
                listing.marketplace === "shopee"
                  ? "bg-[#EE4D2D]/15 text-[#EE4D2D]"
                  : "bg-[#FFE600]/15 text-[#c9b400]",
              )}
            >
              {CHANNEL_LABEL[listing.marketplace]}
            </span>
            <span>{listing.externalId}</span>
            {listing.permalink && (
              <a
                href={listing.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-brand underline-offset-2 hover:underline"
              >
                ver <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-muted-foreground">R$</span>
        <Input
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className="h-8 w-24 text-[13px]"
          inputMode="decimal"
          aria-label="Preço de venda"
        />
        {dirty && (
          <Button
            size="sm"
            className="h-8 px-2.5"
            disabled={saving}
            onClick={() => void savePrice()}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Salvar"}
          </Button>
        )}
      </div>

      <div className="text-[12px]">
        {pricing ? (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">
              Custo {formatBRL(pricing.costCents)} + emb. {formatBRL(PACKAGING_FEE_CENTS)} · Taxa{" "}
              {formatBRL(pricing.feeCents)}
            </p>
            <p
              className={cn(
                "font-semibold",
                pricing.profitCents > 0 ? "text-success" : "text-destructive",
              )}
            >
              Lucro {formatBRL(pricing.profitCents)} ({Math.round(pricing.marginPct * 100)}%)
            </p>
            {costChanged && (
              <p className="text-[11.5px] text-warning">
                O custo mudou de {formatBRL(listing.costCents as number)} para{" "}
                {formatBRL(cost as number)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Custo desconhecido (produto fora do catálogo)</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <div className="text-right">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              listing.status === "active" && "bg-success/15 text-success",
              listing.status === "paused" && "bg-warning/15 text-warning",
              listing.status === "closed" && "bg-muted text-muted-foreground",
            )}
          >
            {STATUS_LABEL[listing.status]}
          </span>
          {listing.pausedBySystem && listing.pauseReason && (
            <p className="mt-1 text-[11px] text-muted-foreground">{listing.pauseReason}</p>
          )}
        </div>
        {listing.status !== "closed" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5"
            disabled={toggling}
            onClick={() => void toggle()}
          >
            {toggling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : listing.status === "active" ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {listing.status === "active" ? "Pausar" : "Ativar"}
          </Button>
        )}
      </div>
    </div>
  );
}

// Revisão de preços: anúncios cujo custo no fornecedor mudou desde a
// publicação (ou desde a última revisão). Sugere o preço que mantém a mesma
// margem de antes.
function PriceReviewPanel({
  listings,
  onChanged,
}: {
  listings: MyListing[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const items = listings
    .filter((l) => l.status !== "closed" && l.costCents !== null)
    .map((l) => {
      const newCost = currentCost(l);
      if (newCost === null || newCost === l.costCents) return null;
      const before = calcPricing(
        l.marketplace,
        l.costCents as number,
        l.priceCents,
        PACKAGING_FEE_CENTS,
      );
      const now = calcPricing(l.marketplace, newCost, l.priceCents, PACKAGING_FEE_CENTS);
      const suggested = suggestPrice(
        l.marketplace,
        newCost,
        Math.max(before.marginPct, 0.05),
        PACKAGING_FEE_CENTS,
      );
      return { l, newCost, before, now, suggested };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) return null;

  const act = async (id: string, newPriceCents: number | null) => {
    setBusy(id);
    try {
      await reviewListingCost({ data: { id, newPriceCents } });
      toast.success(newPriceCents ? "Preço atualizado no canal" : "Preço mantido");
      onChanged();
    } catch (err) {
      toast.error("Não deu pra salvar", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="surface-card overflow-hidden border-warning/40">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[14px] font-semibold text-foreground">
          Revisão de preços ({items.length})
        </p>
        <p className="text-[12px] text-muted-foreground">
          O custo no fornecedor mudou. Aplique o preço sugerido pra manter o seu lucro, ou mantenha
          o preço atual.
        </p>
      </div>
      <div className="divide-y divide-border">
        {items.map(({ l, newCost, before, now, suggested }) => (
          <div
            key={l.id}
            className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="min-w-0">
              <p className="line-clamp-1 text-[13px] font-medium text-foreground">{l.title}</p>
              <p className="text-[12px] text-muted-foreground">
                Custo {formatBRL(l.costCents as number)} → {formatBRL(newCost)} · Lucro{" "}
                {formatBRL(before.profitCents)} →{" "}
                <span className={now.profitCents > 0 ? "text-foreground" : "text-destructive"}>
                  {formatBRL(now.profitCents)}
                </span>{" "}
                no preço atual de {formatBRL(l.priceCents)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                disabled={busy === l.id || suggested === l.priceCents}
                onClick={() => void act(l.id, suggested)}
              >
                {busy === l.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  `Aplicar ${formatBRL(suggested)}`
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === l.id}
                onClick={() => void act(l.id, null)}
              >
                Manter preço
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnunciosPage() {
  const [listings, setListings] = useState<MyListing[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [manualExtra, setManualExtra] = useState(0);
  useEffect(() => {
    getManualListingsExtra()
      .then(setManualExtra)
      .catch(() => setManualExtra(0));
  }, []);

  const load = async () => {
    try {
      setListings(await listMyListings());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra carregar seus anúncios.");
      setListings([]);
    }
  };

  const sync = async (silent = false) => {
    setSyncing(true);
    try {
      const result = await syncMyListings();
      const imported = Object.values(result).reduce(
        (n, r) => n + ("imported" in r ? r.imported : 0),
        0,
      );
      if (!silent) {
        toast.success(
          imported > 0
            ? `${imported} anúncio(s) importado(s) da sua loja`
            : "Anúncios atualizados com a loja",
        );
      }
      await load();
    } catch (err) {
      if (!silent) {
        toast.error("Não deu pra atualizar com a loja", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void load().then(() => void sync(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (listings ?? []).filter(
      (l) =>
        (channel === "all" || l.marketplace === channel) &&
        (status === "all" || l.status === status) &&
        (!q || l.title.toLowerCase().includes(q) || l.externalId.includes(q)),
    );
  }, [listings, channel, status, query]);

  const counts = useMemo(() => {
    const all = listings ?? [];
    return {
      total: all.length + manualExtra,
      active: all.filter((l) => l.status === "active").length + manualExtra,
      paused: all.filter((l) => l.status === "paused").length,
      loss: all.filter((l) => {
        const cost = currentCost(l);
        return (
          l.status === "active" &&
          cost !== null &&
          calcPricing(l.marketplace, cost, l.priceCents, PACKAGING_FEE_CENTS).profitCents <= 0
        );
      }).length,
    };
  }, [listings, manualExtra]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Meus anúncios"
        description={DESCRIPTION}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            disabled={syncing}
            onClick={() => void sync()}
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Atualizar da loja
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Anúncios", value: counts.total },
          { label: "Ativos", value: counts.active },
          { label: "Pausados", value: counts.paused },
          { label: "Ativos com prejuízo", value: counts.loss, danger: counts.loss > 0 },
        ].map((c) => (
          <div key={c.label} className="surface-card p-4">
            <p className="text-[12px] text-muted-foreground">{c.label}</p>
            <p
              className={cn(
                "mt-1 text-[22px] font-semibold text-foreground",
                c.danger && "text-destructive",
              )}
            >
              {listings === null ? "—" : c.value}
            </p>
          </div>
        ))}
      </div>

      {listings && <PriceReviewPanel listings={listings} onChanged={() => void load()} />}

      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou código do anúncio"
              className="h-9 pl-8 text-[13px]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelFilter)}
              className="h-9 rounded-md border border-border bg-background px-2 text-[13px]"
              aria-label="Canal"
            >
              <option value="all">Todos os canais</option>
              <option value="shopee">Shopee</option>
              <option value="mercado-livre">Mercado Livre</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-border bg-background px-2 text-[13px]"
              aria-label="Situação"
            >
              <option value="all">Todas as situações</option>
              <option value="active">Ativos</option>
              <option value="paused">Pausados</option>
              <option value="closed">Encerrados</option>
            </select>
          </div>
        </div>

        {listings === null ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Megaphone}
              title={listings.length === 0 ? "Nenhum anúncio ainda" : "Nada com esse filtro"}
              description={
                listings.length === 0
                  ? "Publique pelo Criar Anúncio ou clique em “Atualizar da loja” pra trazer os anúncios que você já tem."
                  : "Mude a busca ou os filtros."
              }
              action={
                listings.length === 0 ? (
                  <Button asChild>
                    <Link to="/criar-anuncio">Criar anúncio</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <ListingRow
                key={`${l.id}-${l.priceCents}-${l.status}`}
                listing={l}
                onChanged={() => void load()}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        Lucro estimado com a tabela de taxas de cada canal, o custo atual do fornecedor e R$ 2 de
        embalagem. Frete e imposto não entram na conta.
      </p>
    </div>
  );
}
