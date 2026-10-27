import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessageCircleQuestion, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";
import { calcPricing } from "@/lib/marketplace-fees";
import {
  answerMlQuestion,
  getProfitReportData,
  listMlQuestions,
  listReturns,
  suggestMlAnswer,
  type MlQuestion,
  type ProfitReportRow,
  type ReturnCase,
} from "@/lib/postsale.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Perguntas dos compradores, devoluções e quanto você lucrou de verdade em cada período.";

export const Route = createFileRoute("/_shell/pos-venda")({
  head: () => ({
    meta: [{ title: "Pós-venda · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: PosVendaPage,
});

const CHANNEL = { shopee: "Shopee", "mercado-livre": "Mercado Livre" } as const;
const PACKAGING_FEE_CENTS = 200;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

// ---------------------------------------------------------------- perguntas

function QuestionItem({ q, onAnswered }: { q: MlQuestion; onAnswered: () => void }) {
  const [text, setText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [sending, setSending] = useState(false);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const { answer } = await suggestMlAnswer({
        data: { question: q.text, itemTitle: q.itemTitle },
      });
      setText(answer);
    } catch (err) {
      toast.error("Não deu pra sugerir agora", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSuggesting(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      await answerMlQuestion({ data: { questionId: q.id, text } });
      toast.success("Resposta publicada no Mercado Livre");
      onAnswered();
    } catch (err) {
      toast.error("Não deu pra responder", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2.5 px-4 py-4">
      <div className="flex items-start gap-3">
        {q.itemThumbnail ? (
          <img src={q.itemThumbnail} alt="" className="size-10 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="size-10 shrink-0 rounded-md bg-surface-hover" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-1 text-[12px] text-muted-foreground">{q.itemTitle}</p>
          <p className="text-[13.5px] font-medium text-foreground">“{q.text}”</p>
          <p className="text-[11px] text-muted-foreground">{fmtDate(q.createdAt)}</p>
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva a resposta ou peça uma sugestão pra IA"
        className="min-h-20 text-[13px]"
        maxLength={2000}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={suggesting}
          onClick={() => void suggest()}
        >
          {suggesting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Sugerir resposta
        </Button>
        <Button size="sm" disabled={sending || text.trim().length < 2} onClick={() => void send()}>
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Responder no Mercado Livre"}
        </Button>
      </div>
    </div>
  );
}

function QuestionsTab() {
  const [state, setState] = useState<{
    connected: boolean;
    blocked?: boolean;
    questions: MlQuestion[];
  } | null>(null);
  const load = async () => {
    setState(null);
    try {
      setState(await listMlQuestions());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra carregar as perguntas.");
      setState({ connected: true, questions: [] });
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-[13px] text-muted-foreground">
          Perguntas sem resposta no seu Mercado Livre. Responder rápido conta muito pra conta nova.
          A Shopee não libera as perguntas pra sistemas externos — lá, responda pelo app.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="ml-3 shrink-0 gap-1.5"
          onClick={() => void load()}
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </Button>
      </div>
      {state === null ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !state.connected ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          Conecte sua conta do Mercado Livre em Integrações pra ver as perguntas aqui.
        </p>
      ) : state.blocked ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          O Mercado Livre ainda não liberou as perguntas para o Shoppfy nesta conta. Vá em
          Integrações, desconecte o Mercado Livre e conecte de novo. Se continuar, responda pelo app
          do Mercado Livre enquanto a liberação não sai.
        </p>
      ) : state.questions.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          Nenhuma pergunta esperando resposta.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {state.questions.map((q) => (
            <QuestionItem key={q.id} q={q} onAnswered={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- devoluções

function ReturnsTab() {
  const [state, setState] = useState<{
    returns: ReturnCase[];
    errors: Record<string, string>;
  } | null>(null);
  useEffect(() => {
    listReturns()
      .then(setState)
      .catch(() => setState({ returns: [], errors: {} }));
  }, []);

  return (
    <div className="surface-card overflow-hidden">
      <p className="border-b border-border px-4 py-3 text-[13px] text-muted-foreground">
        Devoluções e reclamações abertas nos últimos 60 dias, buscadas direto nos canais. Para
        responder, use o painel do canal.
      </p>
      {state === null ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : state.returns.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          Nenhuma devolução.
          {Object.keys(state.errors).length > 0 && (
            <span className="mt-1 block text-[11.5px]">
              Não deu pra consultar:{" "}
              {Object.keys(state.errors)
                .map((k) => CHANNEL[k as keyof typeof CHANNEL])
                .join(", ")}
              .
            </span>
          )}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {state.returns.map((r) => (
            <div
              key={`${r.marketplace}-${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  {CHANNEL[r.marketplace]} · pedido {r.orderId ?? "—"}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {r.reason ?? "Motivo não informado"} · aberta em {fmtDate(r.createdAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- relatório

function ReportTab() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<ProfitReportRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    getProfitReportData({ data: { days } })
      .then(setRows)
      .catch(() => setRows([]));
  }, [days]);

  const report = useMemo(() => {
    if (!rows) return null;
    let sale = 0;
    let fees = 0;
    let cost = 0;
    let unknownCost = 0;
    const byProduct = new Map<string, { qty: number; profit: number }>();
    const byChannel = new Map<string, { orders: number; sale: number }>();
    for (const r of rows) {
      const unit = Math.round(r.saleCents / Math.max(r.quantity, 1));
      const fee = calcPricing(r.marketplace, 0, unit, 0).feeCents * r.quantity;
      const c = r.costCents === null ? null : r.costCents + PACKAGING_FEE_CENTS * r.quantity;
      sale += r.saleCents;
      fees += fee;
      if (c === null) unknownCost++;
      else cost += c;
      const profit = r.saleCents - fee - (c ?? 0);
      const p = byProduct.get(r.productName) ?? { qty: 0, profit: 0 };
      byProduct.set(r.productName, { qty: p.qty + r.quantity, profit: p.profit + profit });
      const ch = byChannel.get(r.marketplace) ?? { orders: 0, sale: 0 };
      byChannel.set(r.marketplace, { orders: ch.orders + 1, sale: ch.sale + r.saleCents });
    }
    const profit = sale - fees - cost;
    return {
      orders: rows.length,
      sale,
      fees,
      cost,
      profit,
      margin: sale > 0 ? profit / sale : 0,
      ticket: rows.length > 0 ? Math.round(sale / rows.length) : 0,
      unknownCost,
      top: [...byProduct.entries()].sort((a, b) => b[1].profit - a[1].profit).slice(0, 8),
      byChannel: [...byChannel.entries()],
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            size="sm"
            variant={d === days ? "default" : "outline"}
            onClick={() => setDays(d)}
          >
            {d} dias
          </Button>
        ))}
      </div>

      {report === null ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="surface-card divide-y divide-border">
            {[
              { label: "Vendas (o que os compradores pagaram)", value: report.sale },
              { label: "(−) Taxas estimadas dos canais", value: -report.fees },
              { label: "(−) Custo dos produtos + embalagem", value: -report.cost },
            ].map((l) => (
              <div key={l.label} className="flex justify-between px-4 py-2.5 text-[13px]">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="text-foreground">{formatBRL(l.value)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 text-[14px] font-semibold">
              <span>Lucro estimado</span>
              <span className={report.profit >= 0 ? "text-success" : "text-destructive"}>
                {formatBRL(report.profit)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Vendas", value: String(report.orders) },
              { label: "Margem", value: `${Math.round(report.margin * 100)}%` },
              { label: "Ticket médio", value: formatBRL(report.ticket) },
            ].map((c) => (
              <div key={c.label} className="surface-card p-4">
                <p className="text-[12px] text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-[20px] font-semibold text-foreground">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="surface-card">
            <p className="border-b border-border px-4 py-3 text-[13px] font-medium text-foreground">
              Produtos que mais deram lucro
            </p>
            {report.top.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                Ainda não há vendas neste período.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {report.top.map(([name, v]) => (
                  <div key={name} className="flex justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span className="line-clamp-1 text-foreground">{name}</span>
                    <span
                      className={cn(
                        "shrink-0",
                        v.profit >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {v.qty} un. · {formatBRL(v.profit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Estimativa gerencial a partir das vendas importadas: taxas pela tabela de cada canal,
            custo do fornecedor e R$ 2 de embalagem por unidade. Frete e imposto não entram.
            {report.unknownCost > 0 &&
              ` ${report.unknownCost} venda(s) de produto fora do catálogo entraram sem custo.`}
          </p>
        </>
      )}
    </div>
  );
}

function PosVendaPage() {
  return (
    <div className="space-y-7">
      <PageHeader title="Pós-venda" description={DESCRIPTION} />
      <Tabs defaultValue="perguntas">
        <TabsList>
          <TabsTrigger value="perguntas" className="gap-1.5">
            <MessageCircleQuestion className="size-3.5" /> Perguntas
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="gap-1.5">
            <Undo2 className="size-3.5" /> Devoluções
          </TabsTrigger>
          <TabsTrigger value="relatorio">Relatório de lucro</TabsTrigger>
        </TabsList>
        <TabsContent value="perguntas" className="mt-4">
          <QuestionsTab />
        </TabsContent>
        <TabsContent value="devolucoes" className="mt-4">
          <ReturnsTab />
        </TabsContent>
        <TabsContent value="relatorio" className="mt-4">
          <ReportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
