import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Send, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PedidoPrefill } from "@/components/pedidos/pedido-form";
import { findCatalogProductById } from "@/lib/catalog";
import { formatBRL } from "@/lib/format";
import {
  dismissImportedOrder,
  getImportedOrderLabel,
  importMyOrders,
  listImportedOrders,
  type ImportedOrder,
} from "@/lib/orders.functions";
import { cn } from "@/lib/utils";

const CHANNEL = { shopee: "Shopee", "mercado-livre": "Mercado Livre" } as const;

function base64ToPdfFile(base64: string, name: string): File {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: "application/pdf" });
}

// "Vendas pra enviar ao fornecedor": vendas que chegaram sozinhas da Shopee e
// do Mercado Livre. Um clique preenche o formulário de pedido abaixo; o
// cliente só confere, paga o Pix e anexa o comprovante.
export function ImportedOrdersCard({
  refreshKey,
  onPick,
}: {
  refreshKey: number;
  onPick: (prefill: PedidoPrefill) => void;
}) {
  const [orders, setOrders] = useState<ImportedOrder[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setOrders(await listImportedOrders());
    } catch {
      setOrders([]);
    }
  };

  const importNow = async (silent: boolean) => {
    setImporting(true);
    try {
      const r = await importMyOrders();
      if (!silent) {
        toast.success(
          r.imported > 0 ? `${r.imported} venda(s) nova(s) encontrada(s)` : "Nenhuma venda nova",
        );
      }
      await load();
    } catch (err) {
      if (!silent) {
        toast.error("Não deu pra buscar as vendas agora", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    void load().then(() => void importNow(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey]);

  const pending = (orders ?? []).filter((o) => !o.fulfillmentRequestId);

  const pick = async (o: ImportedOrder) => {
    setBusy(o.id);
    let labelFile: File | null = null;
    if (o.marketplace === "mercado-livre" && o.shipmentId) {
      try {
        const { base64 } = await getImportedOrderLabel({ data: { id: o.id } });
        labelFile = base64ToPdfFile(base64, `etiqueta-ml-${o.externalOrderId}.pdf`);
        toast.success("Etiqueta do Mercado Livre anexada");
      } catch (err) {
        toast.message("Anexe a etiqueta manualmente", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
    onPick({
      key: `${o.id}-${Date.now()}`,
      importedOrderId: o.id,
      product: findCatalogProductById(o.productId),
      notes: `Venda ${CHANNEL[o.marketplace]} nº ${o.externalOrderId}${
        o.quantity > 1 ? ` · ${o.quantity} unidades` : ""
      }`,
      labelFile,
    });
    setBusy(null);
    document.getElementById("pedido-form-anchor")?.scrollIntoView({ behavior: "smooth" });
  };

  const dismiss = async (o: ImportedOrder) => {
    setBusy(o.id);
    try {
      await dismissImportedOrder({ data: { id: o.id } });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <ShoppingBag className="size-4 text-brand" />
            Vendas pra enviar ao fornecedor
            {pending.length > 0 && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] text-brand-foreground">
                {pending.length}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            As vendas da sua Shopee e do seu Mercado Livre chegam aqui sozinhas. Clique em “Enviar
            ao fornecedor” e o pedido já vem preenchido.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={importing}
          onClick={() => void importNow(false)}
        >
          {importing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Buscar vendas
        </Button>
      </div>

      {orders === null ? (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : pending.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          Nenhuma venda esperando. Quando vender, ela aparece aqui e você recebe um aviso no
          celular.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {pending.map((o) => (
            <div key={o.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {o.productImageUrl ? (
                  <img
                    src={o.productImageUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-md bg-surface-hover object-cover"
                  />
                ) : (
                  <div className="size-12 shrink-0 rounded-md bg-surface-hover" />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[13px] font-medium text-foreground">
                    {o.productName}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    <span
                      className={cn(
                        "mr-1.5 rounded px-1.5 py-0.5 font-medium",
                        o.marketplace === "shopee"
                          ? "bg-[#EE4D2D]/15 text-[#EE4D2D]"
                          : "bg-[#FFE600]/15 text-[#c9b400]",
                      )}
                    >
                      {CHANNEL[o.marketplace]}
                    </span>
                    nº {o.externalOrderId} ·{" "}
                    {new Date(o.orderedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {o.quantity > 1 && ` · ${o.quantity} un.`}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Vendeu por {formatBRL(o.saleCents)}
                    {o.costCents !== null
                      ? ` · custo ${formatBRL(o.costCents)}`
                      : " · produto fora do catálogo"}
                  </p>
                  {o.quantity > 1 && (
                    <p className="text-[11.5px] text-warning">
                      Venda com {o.quantity} unidades: envie {o.quantity} pedidos (um por unidade).
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={busy === o.id || !o.productId}
                  onClick={() => void pick(o)}
                  title={o.productId ? undefined : "Produto fora do catálogo do fornecedor"}
                >
                  {busy === o.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Enviar ao fornecedor
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2"
                  disabled={busy === o.id}
                  onClick={() => void dismiss(o)}
                  title="Tirar da lista (venda cancelada ou resolvida por fora)"
                  aria-label="Tirar da lista"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
