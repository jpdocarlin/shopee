import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Gauge,
  Loader2,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import {
  getStoreInsights,
  setWeeklyTask,
  type Reputation,
  type StoreInsights,
  type StoreScore,
} from "@/lib/store-health.functions";
import { cn } from "@/lib/utils";

const STORE = {
  shopee: { name: "Shopee", logo: "/logo-shopee.png" },
  "mercado-livre": { name: "Mercado Livre", logo: "/logo-mercadolivre.png" },
} as const;

export function useStoreInsights() {
  const [data, setData] = useState<StoreInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getStoreInsights()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Não deu pra carregar."));
  }, []);
  return { data, setData, error };
}

function SectionTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: typeof Gauge;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
        <Icon className="size-4 text-brand" /> {children}
      </p>
      {right}
    </div>
  );
}

function Logo({ ch }: { ch: keyof typeof STORE }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-white">
      <img src={STORE[ch].logo} alt={STORE[ch].name} className="size-5 object-contain" />
    </span>
  );
}

const TONE = {
  good: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

function scoreTone(score: number) {
  return score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
}

// ------------------------------------------------------- tarefas da semana

export function WeeklyTasks({
  data,
  onChange,
}: {
  data: StoreInsights;
  onChange: (next: StoreInsights) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const done = data.tasks.filter((t) => t.done).length;
  const toggle = async (id: string, value: boolean) => {
    setBusy(id);
    try {
      await setWeeklyTask({ data: { id, done: value } });
      onChange({
        ...data,
        tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: value } : t)),
      });
    } catch {
      toast.error("Não deu pra salvar agora.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="surface-card overflow-hidden">
      <SectionTitle
        icon={ClipboardCheck}
        right={
          data.tasks.length > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {done}/{data.tasks.length} feitas
            </span>
          )
        }
      >
        Tarefas da semana
      </SectionTitle>
      {data.tasks.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          Nenhuma tarefa esta semana — não encontramos nada que precise de correção agora.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {data.tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-5 py-3">
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => void toggle(t.id, !t.done)}
                aria-label={t.done ? "Marcar como pendente" : "Marcar como feita"}
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors",
                  t.done && "border-success bg-success text-success-foreground",
                )}
              >
                {busy === t.id ? (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                ) : (
                  <Check className="size-3" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-medium text-foreground",
                    t.done && "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </p>
                {t.detail && <p className="text-[12px] text-muted-foreground">{t.detail}</p>}
              </div>
              {t.link && !t.done && (
                <Link to={t.link} className="shrink-0 text-[12px] text-brand hover:underline">
                  Abrir
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------- nota + reputação por loja

function ReputationBlock({ r }: { r: Reputation }) {
  if (!r.available) {
    return (
      <p className="text-[12px] text-muted-foreground">
        {r.unavailableReason ?? "Reputação indisponível no momento."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", TONE[r.tone])}>
          {r.label}
        </span>
        {r.penaltyPoints !== undefined && (
          <span className="text-[12px] text-muted-foreground">
            {r.penaltyPoints} ponto(s) de penalidade no trimestre
          </span>
        )}
        {r.issuesCount ? (
          <span className="text-[12px] text-muted-foreground">
            · {r.issuesCount} anúncio(s) apontados pela Shopee
          </span>
        ) : null}
      </div>
      {r.punishments?.map((p) => (
        <p key={p} className="text-[12px] font-medium text-destructive">
          Restrição ativa: {p}
        </p>
      ))}
      {r.metrics.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {r.metrics.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[12px]"
            >
              <span className="text-muted-foreground">{m.name}</span>
              <span
                className={cn(
                  "font-medium",
                  m.ok === false ? "text-destructive" : m.ok ? "text-success" : "text-foreground",
                )}
                title={m.target ?? undefined}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StoreScores({ data }: { data: StoreInsights }) {
  if (data.connected.length === 0) return null;
  return (
    <div className={cn("grid gap-4", data.connected.length > 1 && "xl:grid-cols-2")}>
      {data.connected.map((ch) => {
        const s: StoreScore | undefined = data.scores.find((x) => x.marketplace === ch);
        const rep = data.reputation.find((x) => x.marketplace === ch);
        return (
          <div key={ch} className="surface-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
              <Logo ch={ch} />
              <p className="flex-1 text-[14px] font-semibold text-foreground">
                {ch === "shopee" ? "Saúde da Shopee" : "Saúde do Mercado Livre"}
              </p>
              {s && (
                <p className={cn("text-[24px] font-semibold tabular-nums", scoreTone(s.score))}>
                  {s.score}
                  <span className="text-[12px] font-normal text-muted-foreground">/100</span>
                </p>
              )}
            </div>
            <div className="space-y-4 p-5">
              {s && s.drags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-foreground">
                    O que está puxando a nota pra baixo
                  </p>
                  <div className="space-y-1">
                    {s.drags.map((d) => (
                      <div
                        key={d.label}
                        className="flex items-center justify-between gap-3 text-[12.5px]"
                      >
                        <span className="text-foreground/90">• {d.label}</span>
                        <span className="shrink-0 text-destructive">−{d.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s && s.drags.length === 0 && (
                <p className="text-[12.5px] text-success">Nada puxando a nota pra baixo agora.</p>
              )}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-brand" /> Reputação da conta
                </p>
                {rep ? (
                  <ReputationBlock r={rep} />
                ) : (
                  <p className="text-[12px] text-muted-foreground">Carregando…</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------- anúncios parados

export function StaleListings({ data }: { data: StoreInsights }) {
  const waitingShopee = data.connected.includes("shopee") && !data.shopeeStaleReady;
  return (
    <div className="surface-card overflow-hidden">
      <SectionTitle icon={MoonStar}>Anúncios parados</SectionTitle>
      {data.stale.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          {waitingShopee
            ? "Na Shopee, a gente precisa de 14 dias de acompanhamento pra saber quais anúncios estão sem visita. Nenhum anúncio parado no Mercado Livre."
            : "Nenhum anúncio sem visita nos últimos 30 dias."}
        </p>
      ) : (
        <>
          <p className="px-5 pt-3 text-[12px] text-muted-foreground">
            Sem nenhuma visita no período. Refaça o título com palavras de busca e troque a foto de
            capa — se mesmo assim não vier ninguém, vale pausar.
          </p>
          <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
            {data.stale.map((s) => (
              <div key={s.listingId} className="flex items-center gap-3 px-5 py-2.5">
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-9 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-9 shrink-0 rounded-md bg-surface-hover" />
                )}
                <p className="line-clamp-1 flex-1 text-[12.5px] text-foreground">{s.title}</p>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">
                  {STORE[s.marketplace].name} · {s.days} dias sem visita
                </span>
              </div>
            ))}
          </div>
          {waitingShopee && (
            <p className="border-t border-border px-5 py-2.5 text-[11.5px] text-muted-foreground">
              Shopee: em acompanhamento — aparecem aqui depois de 14 dias.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------- qualidade (Mercado Livre)

export function MlQualityList({ data }: { data: StoreInsights }) {
  if (!data.connected.includes("mercado-livre")) return null;
  return (
    <div className="surface-card overflow-hidden">
      <SectionTitle icon={Star}>Qualidade dos anúncios no Mercado Livre</SectionTitle>
      {data.mlQuality.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          O Mercado Livre ainda não calculou a qualidade dos seus anúncios.
        </p>
      ) : (
        <div className="max-h-[360px] divide-y divide-border overflow-y-auto">
          {data.mlQuality.map((q) => (
            <div key={q.listingId} className="flex gap-3 px-5 py-3">
              {q.imageUrl ? (
                <img
                  src={q.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-10 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-md bg-surface-hover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-[12.5px] font-medium text-foreground">
                    {q.title}
                  </p>
                  {q.score !== null && (
                    <span className={cn("shrink-0 text-[13px] font-semibold", scoreTone(q.score))}>
                      {q.score}/100
                    </span>
                  )}
                </div>
                {q.actions.length === 0 ? (
                  <p className="text-[11.5px] text-success">Tudo completo.</p>
                ) : (
                  q.actions.map((a) => (
                    <p key={a} className="text-[11.5px] text-muted-foreground">
                      • {a}
                    </p>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------- oportunidades do catálogo

export function Opportunities({ data }: { data: StoreInsights }) {
  return (
    <div className="surface-card overflow-hidden">
      <SectionTitle icon={Sparkles}>Oportunidades do catálogo</SectionTitle>
      {data.opportunities.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          Assim que os lojistas da Shoppfy venderem produtos que você ainda não anunciou, eles
          aparecem aqui.
        </p>
      ) : (
        <>
          <p className="px-5 pt-3 text-[12px] text-muted-foreground">
            Produtos da C7 que você ainda não anunciou — primeiro os que mais venderam entre os
            lojistas da Shoppfy, depois os com estoque e lucro bom. Muda toda semana.
          </p>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.opportunities.map((o) => (
              <div key={o.productId} className="flex gap-3 rounded-lg border border-border p-3">
                <img
                  src={o.image}
                  alt=""
                  loading="lazy"
                  className="size-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="line-clamp-2 text-[12.5px] font-medium text-foreground">{o.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {o.reason} · custo {formatBRL(o.costCents)}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Shopee a {formatBRL(o.suggestedShopeeCents)} → lucro{" "}
                    <span className="text-success">{formatBRL(o.profitShopeeCents)}</span>
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 gap-1 text-[12px]"
                  >
                    <Link to="/criar-anuncio">
                      Anunciar <ArrowUpRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InsightsLoading({ error }: { error: string | null }) {
  return (
    <div className="surface-card flex items-center justify-center gap-2 px-5 py-8 text-[12.5px] text-muted-foreground">
      {error ? (
        error
      ) : (
        <>
          <Loader2 className="size-4 animate-spin" /> Analisando reputação, anúncios e
          oportunidades…
        </>
      )}
    </div>
  );
}
