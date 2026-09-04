import { useEffect, useState } from "react";
import { Download, Loader2, PackageSearch, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useIsOwner } from "@/lib/owner";
import { formatBRL } from "@/lib/format";
import {
  STATUS_LABEL,
  getAttachmentSignedUrl,
  listFulfillmentRequests,
  updateFulfillmentStatus,
  type FulfillmentRequest,
  type FulfillmentStatus,
} from "@/lib/fulfillment";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: FulfillmentStatus): "secondary" | "default" | "destructive" {
  if (status === "canceled") return "destructive";
  if (status === "shipped" || status === "confirmed") return "default";
  return "secondary";
}

function AttachmentLink({ path, label }: { path: string | null; label: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (!path) return;
    setLoading(true);
    try {
      const url = await getAttachmentSignedUrl(path);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Não deu pra abrir o anexo agora");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!path) {
    return <span className="text-[11.5px] text-muted-foreground">{label}: —</span>;
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[11.5px] text-brand underline-offset-2 hover:underline disabled:opacity-50"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      {label}
    </button>
  );
}

function PedidoRow({
  request,
  isOwner,
  onStatusChange,
}: {
  request: FulfillmentRequest;
  isOwner: boolean;
  onStatusChange: (id: string, status: FulfillmentStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">{request.product_name}</p>
          <Badge variant={statusVariant(request.status)} className="shrink-0">
            {STATUS_LABEL[request.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          {isOwner && <span className="text-foreground">{request.submitter_name}</span>}
          <span>Custo: {formatBRL(request.cost_cents)}</span>
          <span>{formatDateTime(request.created_at)}</span>
          <AttachmentLink path={request.label_path} label="Etiqueta" />
          <AttachmentLink path={request.proof_path} label="Comprovante PIX" />
        </div>
        {request.tracking_code && (
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-brand">
            <Truck className="size-3 shrink-0" />
            Rastreio: {request.tracking_code}
          </p>
        )}
        {request.notes && (
          <p className="text-[11.5px] text-muted-foreground">Obs: {request.notes}</p>
        )}
      </div>

      {isOwner && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {(["pending", "confirmed", "shipped", "canceled"] as FulfillmentStatus[]).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(request.id, status)}
                disabled={request.status === status}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-default disabled:border-brand/40 disabled:bg-brand/10 disabled:text-brand"
              >
                {STATUS_LABEL[status]}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function PedidosList({ refreshKey }: { refreshKey: number }) {
  const isOwner = useIsOwner();
  const [requests, setRequests] = useState<FulfillmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFulfillmentRequests();
      setRequests(data);
    } catch (err) {
      console.error("[PedidosList] falha ao carregar pedidos:", err);
      setError(err instanceof Error ? err.message : "Não deu pra carregar os pedidos agora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const handleStatusChange = async (id: string, status: FulfillmentStatus) => {
    const previous = requests;
    setRequests((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await updateFulfillmentStatus(id, status);
    } catch (err) {
      console.error("[PedidosList] falha ao atualizar status:", err);
      setRequests(previous);
      toast.error("Não deu pra atualizar o status agora");
    }
  };

  return (
    <Reveal className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-[14px] font-medium text-foreground">
          {isOwner ? "Todos os pedidos" : "Meus pedidos"}
        </h2>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11.5px]" onClick={load}>
          <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center px-5 py-14 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-[13px] text-destructive">{error}</div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum pedido registrado ainda"
          description="Assim que fechar uma venda, use o formulário acima pra registrar o pedido."
        />
      ) : (
        <div className="divide-y divide-border">
          {requests.map((request) => (
            <PedidoRow
              key={request.id}
              request={request}
              isOwner={isOwner}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </Reveal>
  );
}
