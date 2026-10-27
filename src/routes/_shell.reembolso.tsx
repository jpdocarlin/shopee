import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Headset, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRefundRequest, getMyRefundPage, type MyRefund } from "@/lib/refund.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION = "Peça o reembolso da sua assinatura e acompanhe o andamento por aqui.";

export const Route = createFileRoute("/_shell/reembolso")({
  head: () => ({
    meta: [{ title: "Reembolso · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: ReembolsoPage,
});

const REASONS = [
  "Não estou usando o sistema",
  "Não atendeu o que eu esperava",
  "Não consegui conectar minha loja",
  "Tive problemas técnicos",
  "Encontrei uma alternativa melhor",
  "Outro motivo",
];

const STATUS = {
  pending: { label: "Em análise", icon: Clock, className: "bg-warning/15 text-warning" },
  done: {
    label: "Reembolso concluído",
    icon: CheckCircle2,
    className: "bg-success/15 text-success",
  },
  denied: { label: "Não aprovado", icon: XCircle, className: "bg-destructive/15 text-destructive" },
} as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function RefundStatusList({ refunds }: { refunds: MyRefund[] }) {
  return (
    <div className="surface-card divide-y divide-border">
      <p className="px-4 py-3 text-[14px] font-semibold text-foreground">
        Seus pedidos de reembolso
      </p>
      {refunds.map((r) => {
        const s = STATUS[r.status] ?? STATUS.pending;
        const Icon = s.icon;
        return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-[13px] text-foreground">Solicitado em {fmtDate(r.createdAt)}</p>
              <p className="text-[12px] text-muted-foreground">
                Código {r.purchaseCode} · {r.plan === "vitalicio" ? "Vitalício" : "Mensal"}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                s.className,
              )}
            >
              <Icon className="size-3.5" />
              {s.label}
            </span>
          </div>
        );
      })}
      {refunds[0]?.status === "pending" && (
        <p className="px-4 py-3 text-[12px] text-muted-foreground">
          Você recebeu um e-mail de confirmação. Quando o reembolso for concluído, chega outro
          e-mail e o status muda aqui.
        </p>
      )}
    </div>
  );
}

function ReembolsoPage() {
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<MyRefund[]>([]);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [purchaseCode, setPurchaseCode] = useState("");
  const [plan, setPlan] = useState<"mensal" | "vitalicio">("mensal");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const data = await getMyRefundPage();
      setRefunds(data.refunds);
      setFullName((v) => v || data.prefill.fullName);
      setEmail((v) => v || data.prefill.email);
      setPurchaseCode((v) => v || data.prefill.purchaseCode);
      setPlan(data.prefill.plan as "mensal" | "vitalicio");
      if (data.prefill.daysSincePayment !== null) setDays(String(data.prefill.daysSincePayment));
    } catch {
      // segue com o formulário vazio
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const hasPending = refunds.some((r) => r.status === "pending");
  const daysNum = Number(days);
  const valid =
    fullName.trim() &&
    cpf.replace(/\D/g, "").length >= 11 &&
    /\S+@\S+\.\S+/.test(email) &&
    purchaseCode.trim() &&
    days.trim() !== "" &&
    daysNum >= 0 &&
    reason;

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      const r = await createRefundRequest({
        data: {
          fullName,
          cpf,
          email,
          purchaseCode,
          plan,
          daysSincePayment: daysNum,
          reason,
        },
      });
      toast.success(
        r.alreadyOpen ? "Você já tem um pedido em análise" : "Pedido de reembolso enviado",
        { description: r.alreadyOpen ? undefined : "Enviamos a confirmação pro seu e-mail." },
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra enviar agora. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Reembolso" description={DESCRIPTION} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          {refunds.length > 0 && <RefundStatusList refunds={refunds} />}

          {!hasPending && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-4">
                <Headset className="mt-0.5 size-4 shrink-0 text-brand" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Travou em alguma coisa? Muita gente pede reembolso por não conseguir conectar a
                  loja ou fazer a primeira venda — isso a gente resolve rápido no{" "}
                  <Link to="/atendimento" className="text-brand underline underline-offset-2">
                    atendimento
                  </Link>{" "}
                  ou nas{" "}
                  <Link to="/membros" className="text-brand underline underline-offset-2">
                    aulas
                  </Link>
                  . Se mesmo assim quiser o reembolso, é só preencher abaixo.
                </p>
              </div>

              <div className="surface-card space-y-4 p-5">
                <p className="text-[14px] font-semibold text-foreground">Pedir reembolso</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-nome">Nome completo</Label>
                    <Input
                      id="rb-nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-cpf">CPF</Label>
                    <Input
                      id="rb-cpf"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-email">E-mail (pra receber a confirmação)</Label>
                    <Input
                      id="rb-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-codigo">Código da compra</Label>
                    <Input
                      id="rb-codigo"
                      value={purchaseCode}
                      onChange={(e) => setPurchaseCode(e.target.value)}
                      placeholder="Ex: cmvf…"
                    />
                    {!purchaseCode && (
                      <p className="text-[11.5px] text-muted-foreground">
                        Não sabe o código? Peça no{" "}
                        <Link to="/atendimento" className="text-brand underline underline-offset-2">
                          atendimento
                        </Link>{" "}
                        que ele te envia na hora.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-plano">Plano</Label>
                    <select
                      id="rb-plano"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value as "mensal" | "vitalicio")}
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                    >
                      <option value="mensal">Mensal</option>
                      <option value="vitalicio">Vitalício</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-dias">Há quantos dias você pagou?</Label>
                    <Input
                      id="rb-dias"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rb-motivo">Motivo</Label>
                  <select
                    id="rb-motivo"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                  >
                    <option value="">Selecione um motivo</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Compras online têm 7 dias de direito de arrependimento (Código de Defesa do
                  Consumidor, art. 49). O valor volta no mesmo meio de pagamento usado na compra.
                </p>

                <Button
                  className="w-full gap-2 sm:w-auto"
                  disabled={!valid || sending}
                  onClick={() => void submit()}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Pedir reembolso
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
