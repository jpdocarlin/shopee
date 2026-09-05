import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { formatBRL } from "@/lib/format";
import { getShopeeItemPreview } from "@/lib/shopee-product.functions";

export const Route = createFileRoute("/_shell/anuncio/$itemId")({
  head: () => ({
    meta: [{ title: "Anúncio publicado · Shoppfy" }],
  }),
  component: AnuncioPreviewPage,
});

type Preview = {
  itemId: number;
  name: string;
  status: string;
  priceReais: number | null;
  imageUrl: string | null;
};

function AnuncioPreviewPage() {
  const { itemId } = useParams({ from: "/_shell/anuncio/$itemId" });
  const runPreview = useServerFn(getShopeeItemPreview);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(itemId);
    if (!Number.isFinite(id)) {
      setError("item_id inválido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    runPreview({ data: { itemId: id } })
      .then((result) => {
        if (!result) {
          setError("Não achamos esse anúncio na loja de teste da Shopee.");
          return;
        }
        setPreview(result);
      })
      .catch((err) => {
        console.error("[AnuncioPreview] falha ao buscar anúncio:", err);
        setError(err instanceof Error ? err.message : "Não foi possível buscar o anúncio agora.");
      })
      .finally(() => setLoading(false));
  }, [itemId, runPreview]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Anúncio publicado"
        description="Como o anúncio ficou de verdade na loja de teste da Shopee — dados buscados na hora, direto da API oficial."
      />

      <Link
        to="/criar-anuncio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Voltar pra Criar Anúncio
      </Link>

      <div className="surface-card mx-auto max-w-md p-5">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando o anúncio na Shopee…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && preview && (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {preview.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt={preview.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-[12px] text-muted-foreground">
                  sem foto
                </div>
              )}
            </div>

            <h2 className="mt-4 text-[15px] font-medium leading-snug text-foreground">
              {preview.name}
            </h2>

            <p className="mt-2 text-[20px] font-semibold text-brand">
              {preview.priceReais !== null ? formatBRL(Math.round(preview.priceReais * 100)) : "—"}
            </p>

            <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">
                status: {preview.status}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5">
                item_id {preview.itemId}
              </span>
            </div>

            <p className="mt-4 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Essa é a loja de teste (sandbox) da Shopee — ela não tem uma vitrine pública pra
              navegar como comprador, então essa tela busca os dados reais direto na API e monta
              essa pré-visualização. Quando a Shopee aprovar o app pra produção (Go-Live), o
              anúncio passa a ter uma página de verdade na Shopee.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
