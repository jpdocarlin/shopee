import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Lock, Trophy } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { getChampions, type Champion } from "@/lib/addons.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Os produtos que mais vendem entre os lojistas da Shoppfy, com preço sugerido e lucro na Shopee e no Mercado Livre. Atualiza sozinha.";

export const Route = createFileRoute("/_shell/produtos-campeoes")({
  head: () => ({ meta: [{ title: "Produtos Campeões · Shoppfy" }] }),
  component: ProdutosCampeoesPage,
});

function ProdutosCampeoesPage() {
  const [data, setData] = useState<{ locked: boolean; items: Champion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getChampions()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Não deu pra carregar."));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos Campeões" description={DESCRIPTION} />
      {error ? (
        <p className="surface-card px-4 py-8 text-center text-[13px] text-muted-foreground">
          {error}
        </p>
      ) : !data ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : data.locked ? (
        <div className="surface-card space-y-2 px-4 py-10 text-center">
          <Lock className="mx-auto size-6 text-muted-foreground" />
          <p className="text-[14px] font-medium text-foreground">
            Lista exclusiva de quem comprou os Produtos Campeões
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            Se você comprou e não está vendo, fale com o atendimento.
          </p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border overflow-hidden">
          <div className="hidden grid-cols-[40px_1fr_110px_150px_150px_110px] gap-3 px-5 py-2.5 text-[11.5px] font-medium text-muted-foreground lg:grid">
            <span>#</span>
            <span>Produto</span>
            <span className="text-right">Custo</span>
            <span className="text-right">Shopee (preço · lucro)</span>
            <span className="text-right">Mercado Livre (preço · lucro)</span>
            <span />
          </div>
          {data.items.map((c) => (
            <div
              key={c.productId}
              className="grid gap-3 px-5 py-3 lg:grid-cols-[40px_1fr_110px_150px_150px_110px] lg:items-center"
            >
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  c.rank <= 3 ? "text-brand" : "text-muted-foreground",
                )}
              >
                {c.rank <= 3 ? <Trophy className="inline size-4" /> : null} {c.rank}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="size-11 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[13px] font-medium text-foreground">{c.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {c.reason} · melhor no {c.bestChannel === "shopee" ? "Shopee" : "Mercado Livre"}
                  </p>
                </div>
              </div>
              <span className="text-[12.5px] text-muted-foreground lg:text-right">
                Custo {formatBRL(c.costCents)}
              </span>
              <span className="text-[12.5px] lg:text-right">
                {formatBRL(c.shopee.priceCents)} ·{" "}
                <span className="text-success">{formatBRL(c.shopee.profitCents)}</span>
              </span>
              <span className="text-[12.5px] lg:text-right">
                {formatBRL(c.ml.priceCents)} ·{" "}
                <span className="text-success">{formatBRL(c.ml.profitCents)}</span>
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 text-[12px] lg:justify-self-end"
              >
                <Link to="/criar-anuncio">Anunciar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
