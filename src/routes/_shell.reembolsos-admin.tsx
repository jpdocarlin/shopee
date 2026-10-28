import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { adminListRefunds, adminSetRefundStatus, type AdminRefund } from "@/lib/refund.functions";
import { useIsPedidosAdmin, useRolesReady } from "@/lib/owner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/reembolsos-admin")({
  head: () => ({ meta: [{ title: "Reembolsos (Admin) · Shoppfy" }] }),
  component: ReembolsosAdminPage,
});

const FILTERS = [
  { id: "pending", label: "Em análise" },
  { id: "done", label: "Concluídos" },
  { id: "denied", label: "Não aprovados" },
  { id: "all", label: "Todos" },
] as const;

const BADGE = {
  pending: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
  denied: "bg-destructive/15 text-destructive",
} as const;
const LABEL = { pending: "Em análise", done: "Concluído", denied: "Não aprovado" } as const;

function ReembolsosAdminPage() {
  // Só a conta de admin (role pedidos_admin).
  const ready = useRolesReady();
  const isAdminAccount = useIsPedidosAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !isAdminAccount) void navigate({ to: "/" });
  }, [ready, isAdminAccount, navigate]);

  const [rows, setRows] = useState<AdminRefund[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await adminListRefunds());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra carregar.");
      setRows([]);
    }
  };
  useEffect(() => {
    if (ready && isAdminAccount) void load();
  }, [ready, isAdminAccount]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => filter === "all" || r.status === filter),
    [rows, filter],
  );

  const setStatus = async (r: AdminRefund, status: AdminRefund["status"]) => {
    if (
      status === "done" &&
      !window.confirm(
        `Confirmar que o reembolso de ${r.fullName} já foi feito na Applyfy? O cliente recebe um e-mail.`,
      )
    )
      return;
    setBusy(r.id);
    try {
      await adminSetRefundStatus({ data: { id: r.id, status } });
      toast.success(
        status === "done" ? "Marcado como concluído — e-mail enviado" : "Status atualizado",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra atualizar.");
    } finally {
      setBusy(null);
    }
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reembolsos (Admin)"
        description="Pedidos feitos em /reembolso. Faça o estorno na Applyfy e marque como concluído — o cliente recebe um e-mail."
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {rows && f.id !== "all" && ` (${rows.filter((r) => r.status === f.id).length})`}
          </Button>
        ))}
      </div>

      {rows === null ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="surface-card px-4 py-10 text-center text-[13px] text-muted-foreground">
          Nenhum pedido aqui.
        </p>
      ) : (
        <div className="surface-card divide-y divide-border">
          {shown.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-[14px] font-medium text-foreground">
                  {r.fullName}{" "}
                  <span
                    className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      BADGE[r.status],
                    )}
                  >
                    {LABEL[r.status]}
                  </span>
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  {r.email} · CPF {r.cpf} · {r.plan === "vitalicio" ? "Vitalício" : "Mensal"} ·
                  pagou há {r.daysSincePayment} dia(s)
                  {r.daysSincePayment > 7 && (
                    <span className="text-warning"> (fora dos 7 dias)</span>
                  )}
                </p>
                <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  Código <span className="font-mono text-foreground">{r.purchaseCode}</span>
                  <button
                    type="button"
                    onClick={() => copy(r.purchaseCode)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Copiar código"
                  >
                    <Copy className="size-3.5" />
                  </button>
                  · {r.reason} ·{" "}
                  {new Date(r.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {r.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={busy === r.id}
                      onClick={() => void setStatus(r, "done")}
                    >
                      {busy === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Reembolso feito
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy === r.id}
                      onClick={() => void setStatus(r, "denied")}
                    >
                      <X className="size-3.5" />
                      Não aprovar
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={busy === r.id}
                    onClick={() => void setStatus(r, "pending")}
                  >
                    <RotateCcw className="size-3.5" />
                    Voltar pra análise
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
