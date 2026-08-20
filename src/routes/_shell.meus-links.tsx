import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Package2, Plus, Sparkles, SquarePen, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { MarketplaceBadge } from "@/components/products/marketplace-badge";
import { AddManualLinkModal } from "@/components/products/add-manual-link-modal";
import { DEMO_PRODUCTS } from "@/data/demo-products";
import { formatBRL, formatPercent } from "@/lib/format";
import { useAffiliateStore, type Marketplace } from "@/stores/affiliate-store";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/meus-links")({
  head: () => ({
    meta: [
      { title: "Meus Links · Shoppfy" },
      {
        name: "description",
        content: "Todos os links de afiliado que você já gerou, num só lugar.",
      },
    ],
  }),
  component: MeusLinksPage,
});

// Uma linha pode vir do catálogo (produto pré-carregado, com comissão/categoria
// reais), ser "ad-hoc" salva automaticamente pela extensão do Chrome a partir
// de QUALQUER produto real da Shopee, ou ter sido colada manualmente pela
// pessoa pra um produto que ela já divulga e não está no Shoppfy.
type LinkRow = {
  productId: string;
  title: string;
  marketplace: Marketplace;
  image?: string;
  category?: string;
  commissionRate?: number;
  url: string;
  savedAt: string;
  origin: "catalog" | "extension" | "manual";
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function LinkRowItem({ row, onRemove }: { row: LinkRow; onRemove: (productId: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row.url);
      setCopied(true);
      toast.success("Link copiado");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.info("Copie manualmente", { description: row.url });
    }
  };

  const handleRemove = () => {
    onRemove(row.productId);
    toast.success("Link removido", { description: row.title });
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {row.image ? (
        <img
          src={row.image}
          alt={row.title}
          className="size-11 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-muted-foreground">
          <Package2 className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[13px] font-medium text-foreground">{row.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <MarketplaceBadge marketplace={row.marketplace} />
          {row.category && (
            <span className="text-[11.5px] text-muted-foreground">{row.category}</span>
          )}
          {typeof row.commissionRate === "number" && row.commissionRate > 0 && (
            <>
              <span className="text-[11.5px] text-muted-foreground">·</span>
              <span className="text-[11.5px] text-success">
                {formatPercent(row.commissionRate)} comissão
              </span>
            </>
          )}
          {row.origin === "extension" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10.5px] font-medium text-brand">
              <Sparkles className="size-2.5" />
              Extensão
            </span>
          )}
          {row.origin === "manual" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              <SquarePen className="size-2.5" />
              Manual
            </span>
          )}
        </div>
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer noopener"
          className="block truncate text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {row.url}
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
          {formatDate(row.savedAt)}
        </span>
        <Button
          size="icon"
          variant={copied ? "secondary" : "outline"}
          className="size-8"
          aria-label="Copiar link"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label="Remover link"
          onClick={handleRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MeusLinksPage() {
  const t = useT();
  const links = useAffiliateStore((s) => s.links);
  const removeLink = useAffiliateStore((s) => s.removeLink);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const rows = useMemo<LinkRow[]>(() => {
    return Object.entries(links)
      .map<LinkRow | null>(([productId, saved]) => {
        const product = DEMO_PRODUCTS.find((p) => p.id === productId);
        if (product) {
          return {
            productId,
            title: product.title,
            marketplace: product.marketplace,
            image: product.image,
            category: product.category,
            commissionRate: product.commissionRate,
            url: saved.url,
            savedAt: saved.savedAt,
            origin: "catalog",
          };
        }
        if (saved.meta) {
          return {
            productId,
            title: saved.meta.title,
            marketplace: saved.meta.marketplace,
            image: saved.meta.image,
            url: saved.url,
            savedAt: saved.savedAt,
            origin: saved.meta.source === "manual" ? "manual" : "extension",
          };
        }
        return null;
      })
      .filter((r): r is LinkRow => Boolean(r))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [links]);

  const totalComissao = rows.reduce(
    (sum, r) =>
      sum +
      (r.commissionRate
        ? Math.round(
            (DEMO_PRODUCTS.find((p) => p.id === r.productId)?.priceCents ?? 0) * r.commissionRate,
          )
        : 0),
    0,
  );

  const categorias = new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)));

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Meus Links")}
        description={t(
          "Todos os links de afiliado que você já gerou, num só lugar — copie de novo ou remova quando não quiser mais divulgar.",
        )}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setAddModalOpen(true)}>
            <Plus className="size-3.5" />
            Adicionar link
          </Button>
        }
      />

      <AddManualLinkModal open={addModalOpen} onOpenChange={setAddModalOpen} />

      {rows.length > 0 && (
        <Stagger className="grid gap-3 sm:grid-cols-3">
          <StaggerItem>
            <div className="surface-card p-4">
              <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                Links salvos
              </p>
              <p className="mt-1 text-[22px] font-semibold text-foreground">{rows.length}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="surface-card p-4">
              <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                Comissão por ciclo (1 venda de cada)
              </p>
              <p className="mt-1 text-[22px] font-semibold text-foreground">
                {formatBRL(totalComissao)}
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="surface-card p-4">
              <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                Categorias
              </p>
              <p className="mt-1 text-[22px] font-semibold text-foreground">{categorias.size}</p>
            </div>
          </StaggerItem>
        </Stagger>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Package2}
          title="Nenhum link de afiliado salvo ainda"
          description='Vá em "Produtos", clique em "Afiliar" e cole o link gerado na Shopee — ele aparece aqui. Ou instale a extensão do Shoppfy pra isso acontecer sozinho.'
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/produtos">Ir pra Produtos</Link>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setAddModalOpen(true)}>
                <Plus className="size-3.5" />
                Adicionar link manual
              </Button>
            </div>
          }
        />
      ) : (
        <Reveal className="surface-card overflow-hidden">
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <LinkRowItem key={row.productId} row={row} onRemove={removeLink} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
