import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, Facebook, MessagesSquare, Package2, Wand2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceBadge } from "@/components/products/marketplace-badge";
import { PostScriptModal } from "@/components/products/post-script-modal";
import { GENERAL_GROUPS, NICHES } from "@/data/demo-groups";
import { DEMO_PRODUCTS, type DemoProduct } from "@/data/demo-products";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useT } from "@/i18n/translations";

type GruposSearch = { niche?: string };

export const Route = createFileRoute("/_shell/grupos-divulgacao")({
  validateSearch: (search: Record<string, unknown>): GruposSearch => ({
    niche: typeof search.niche === "string" ? search.niche : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Grupos de Divulgação · Shoppfy" },
      {
        name: "description",
        content: "Grupos do Facebook por nicho, prontos pra você divulgar seus links.",
      },
    ],
  }),
  component: GruposDivulgacaoPage,
});

function FacebookBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground">
      <Facebook className="size-3" />
      Facebook
    </span>
  );
}

function GruposDivulgacaoPage() {
  const t = useT();
  const { niche } = Route.useSearch();
  const [tab, setTab] = useState<string>(niche ?? "geral");
  const links = useAffiliateStore((s) => s.links);
  const [postProduct, setPostProduct] = useState<DemoProduct | null>(null);
  const [postOpen, setPostOpen] = useState(false);

  const affiliatedProducts = useMemo(() => {
    return Object.keys(links)
      .map((id) => DEMO_PRODUCTS.find((p) => p.id === id))
      .filter((p): p is DemoProduct => Boolean(p));
  }, [links]);

  const openPostModal = (product: DemoProduct) => {
    setPostProduct(product);
    setPostOpen(true);
  };

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Grupos de Divulgação")}
        description={t(
          "Grupos do Facebook organizados por nicho + post pronto pra colar, um produto de cada vez.",
        )}
      />

      <Reveal className="surface-card p-4 text-[12.5px] leading-relaxed text-muted-foreground">
        Não existe API do Facebook pra postar ou buscar grupo automaticamente — a Meta descontinuou
        o Groups API em 2024. Por isso aqui você entra no grupo com um clique e cola o texto/imagem
        que a gente já deixa pronto, igual você faria manualmente. Grupo do Facebook fecha ou muda
        de regra com o tempo — se algum link aqui não funcionar mais, avise pra gente atualizar.
      </Reveal>

      {/* Produtos prontos pra divulgar */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Wand2 className="size-4 text-brand" />
          <p className="text-[14px] font-medium text-foreground">Seus produtos afiliados</p>
        </div>
        {affiliatedProducts.length === 0 ? (
          <EmptyState
            icon={Package2}
            title="Nenhum link de afiliado salvo ainda"
            description="Vire afiliado de um produto pra poder gerar o post de divulgação."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/produtos">Ir pra Produtos</Link>
              </Button>
            }
            className="border-0"
          />
        ) : (
          <div className="divide-y divide-border">
            {affiliatedProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 px-5 py-3.5">
                <img
                  src={product.image}
                  alt={product.title}
                  className="size-11 shrink-0 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {product.title}
                  </p>
                  <MarketplaceBadge marketplace={product.marketplace} className="mt-1" />
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-[12.5px]"
                  onClick={() => openPostModal(product)}
                >
                  <Wand2 className="size-3.5" />
                  Gerar post
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diretório de grupos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessagesSquare className="size-4 text-brand" />
          <p className="text-[14px] font-medium text-foreground">Diretório de grupos por nicho</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger
              value="geral"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] data-[state=active]:border-transparent data-[state=active]:bg-surface-hover data-[state=active]:shadow-none"
            >
              Geral
            </TabsTrigger>
            {NICHES.map((n) => (
              <TabsTrigger
                key={n.id}
                value={n.id}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] data-[state=active]:border-transparent data-[state=active]:bg-surface-hover data-[state=active]:shadow-none"
              >
                {n.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="geral" className="mt-4">
            <Stagger stagger={0.04} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {GENERAL_GROUPS.map((group) => (
                <StaggerItem key={group.id}>
                  <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <FacebookBadge />
                      </div>
                      <p className="text-[13.5px] font-medium leading-snug text-foreground">
                        {group.name}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {group.about}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto h-8 gap-1.5 self-start text-[12.5px]"
                      onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
                    >
                      Entrar no grupo
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </TabsContent>

          {NICHES.map((n) => (
            <TabsContent key={n.id} value={n.id} className="mt-4">
              <Stagger stagger={0.03} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {n.groups.map((group) => (
                  <StaggerItem key={group.id}>
                    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <FacebookBadge />
                        </div>
                        <p className="text-[13.5px] font-medium leading-snug text-foreground">
                          {group.name}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto h-8 gap-1.5 self-start text-[12.5px]"
                        onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
                      >
                        Entrar no grupo
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <PostScriptModal
        product={postProduct}
        link={postProduct ? links[postProduct.id]?.url : undefined}
        open={postOpen}
        onOpenChange={setPostOpen}
      />
    </div>
  );
}
