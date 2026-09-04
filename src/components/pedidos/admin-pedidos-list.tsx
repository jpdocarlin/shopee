import { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  Download,
  Loader2,
  Mail,
  Package,
  PackageSearch,
  Phone,
  RefreshCw,
  Send,
  Truck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatBRL } from "@/lib/format";
import {
  PERSON_TYPE_LABEL,
  STATUS_LABEL,
  getAttachmentSignedUrl,
  listFulfillmentRequests,
  sendTrackingCode,
  updateFulfillmentStatus,
  type FulfillmentRequest,
  type FulfillmentStatus,
} from "@/lib/fulfillment";

// Todo pedido pago via PIX inclui R$ 2,00 de embalagem além do custo do
// produto (mesma regra mostrada no formulário de envio).
const PACKAGING_FEE_CENTS = 200;

const STATUS_FILTERS: Array<FulfillmentStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "shipped",
  "canceled",
];

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
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
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11.5px] text-brand transition-colors hover:border-brand/40 disabled:opacity-50"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      {label}
    </button>
  );
}

function TrackingField({
  request,
  onSend,
}: {
  request: FulfillmentRequest;
  onSend: (id: string, code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(request.tracking_code ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setCode(request.tracking_code ?? "");
  }, [request.tracking_code]);

  const handleSend = async () => {
    if (!code.trim() || sending) return;
    setSending(true);
    try {
      await onSend(request.id, code.trim());
      toast.success("Código de rastreio enviado", {
        description: `O revendedor recebe uma notificação agora — ${request.product_name}`,
      });
    } catch (err) {
      console.error("[TrackingField] falha ao enviar código:", err);
      toast.error("Não deu pra enviar o código agora");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-hover/40 p-3.5 sm:col-span-2">
      <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
        <Truck className="size-3.5 text-brand" />
        Código de rastreio
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex: BR123456789BR"
          className="h-8 max-w-[220px] text-[12.5px]"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-[12px]"
          disabled={!code.trim() || sending || code.trim() === (request.tracking_code ?? "")}
          onClick={handleSend}
        >
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {request.tracking_code ? "Atualizar" : "Enviar"}
        </Button>
      </div>
      {request.tracking_sent_at && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enviado em {formatDateTime(request.tracking_sent_at)}
        </p>
      )}
    </div>
  );
}

function PedidoCard({
  request,
  onStatusChange,
  onSendTracking,
}: {
  request: FulfillmentRequest;
  onStatusChange: (id: string, status: FulfillmentStatus) => void;
  onSendTracking: (id: string, code: string) => Promise<void>;
}) {
  const totalCents = request.cost_cents + PACKAGING_FEE_CENTS;

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Package className="size-4 shrink-0 text-brand" />
          <div>
            <p className="text-[13.5px] font-medium text-foreground">{request.product_name}</p>
            <p className="text-[11.5px] text-muted-foreground">
              {formatDateTime(request.created_at)}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(request.status)}>{STATUS_LABEL[request.status]}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-hover/40 p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
            <UserRound className="size-3.5 text-brand" />
            Revendedor
          </div>
          <p className="text-[13px] font-medium text-foreground">{request.submitter_name}</p>
          <div className="mt-1.5 space-y-1 text-[11.5px] text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="size-3 shrink-0" />
              {request.submitter_email}
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0" />
              {request.submitter_phone}
            </p>
            <p>
              {PERSON_TYPE_LABEL[request.submitter_person_type]} · {request.submitter_document}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-hover/40 p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
            <CircleDollarSign className="size-3.5 text-brand" />
            Valores (PIX)
          </div>
          <div className="space-y-1 text-[11.5px] text-muted-foreground">
            <p className="flex items-center justify-between">
              <span>Produto</span>
              <span className="text-foreground">{formatBRL(request.cost_cents)}</span>
            </p>
            <p className="flex items-center justify-between">
              <span>Embalagem</span>
              <span className="text-foreground">{formatBRL(PACKAGING_FEE_CENTS)}</span>
            </p>
            <p className="flex items-center justify-between border-t border-border pt-1 font-medium">
              <span className="text-foreground">Total esperado</span>
              <span className="text-brand">{formatBRL(totalCents)}</span>
            </p>
          </div>
        </div>

        <TrackingField request={request} onSend={onSendTracking} />
      </div>

      {request.notes && (
        <p className="rounded-md bg-surface-hover/40 px-3 py-2 text-[11.5px] text-muted-foreground">
          Obs: {request.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
        <div className="flex flex-wrap gap-1.5">
          <AttachmentLink path={request.label_path} label="Etiqueta" />
          <AttachmentLink path={request.proof_path} label="Comprovante PIX" />
        </div>
        <div className="flex flex-wrap gap-1.5">
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
      </div>
    </div>
  );
}

export function AdminPedidosList() {
  const [requests, setRequests] = useState<FulfillmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FulfillmentStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFulfillmentRequests();
      setRequests(data);
    } catch (err) {
      console.error("[AdminPedidosList] falha ao carregar pedidos:", err);
      setError(err instanceof Error ? err.message : "Não deu pra carregar os pedidos agora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (id: string, status: FulfillmentStatus) => {
    const previous = requests;
    setRequests((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await updateFulfillmentStatus(id, status);
    } catch (err) {
      console.error("[AdminPedidosList] falha ao atualizar status:", err);
      setRequests(previous);
      toast.error("Não deu pra atualizar o status agora");
    }
  };

  const handleSendTracking = async (id: string, code: string) => {
    await sendTrackingCode(id, code);
    setRequests((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              tracking_code: code,
              tracking_sent_at: new Date().toISOString(),
              status: "shipped",
            }
          : r,
      ),
    );
  };

  const filtered = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={
                filter === status
                  ? "rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11.5px] font-medium text-brand"
                  : "rounded-full border border-border bg-card px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              }
            >
              {status === "all" ? "Todos" : STATUS_LABEL[status]}
              {status === "pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11.5px]" onClick={load}>
          <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum pedido por aqui"
          description="Assim que um revendedor registrar uma venda, o pedido aparece nesta lista com todos os dados dele."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <PedidoCard
              key={request.id}
              request={request}
              onStatusChange={handleStatusChange}
              onSendTracking={handleSendTracking}
            />
          ))}
        </div>
      )}
    </div>
  );
}
