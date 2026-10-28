import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AppNotificationsCard } from "@/components/notifications/app-notifications-card";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  StoreHealthPanel,
  type StoreHealthData,
} from "@/components/store-health/store-health-panel";
import { getStoreHealth } from "@/lib/store-health.functions";
import { getGreeting } from "@/lib/greeting";
import { useProfileStore } from "@/stores/profile-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/translations";

const DESCRIPTION =
  "Como está a sua loja: visitas, vendas, lucro, o que melhorar em cada anúncio e o recap de cada semana.";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Shoppfy" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Dashboard · Shoppfy" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: IndexPage,
});

const ONBOARDING_STEPS = [
  {
    id: "connect",
    title: "Conectar sua loja Shopee ou Mercado Livre",
    description: "Leva menos de 1 minuto",
    to: "/integracoes",
  },
  {
    id: "product",
    title: "Criar seu primeiro anúncio",
    description: "Escolha um produto do fornecedor e publique",
    to: "/criar-anuncio",
  },
  {
    id: "content",
    title: "Acompanhar seus pedidos",
    description: "Quando vender, peça pro fornecedor por aqui",
    to: "/pedidos",
  },
] as const;

function IndexPage() {
  const t = useT();
  const name = useProfileStore((s) => s.name);
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  const marketplaceConnected = useAuthStore((s) => Boolean(s.marketplaceConnected));
  const [contentDone, setContentDone] = useState(false);
  const [days, setDays] = useState(7);
  const [data, setData] = useState<StoreHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    getStoreHealth({ data: { days } })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Não deu pra carregar agora."));
  }, [days]);

  const hasListing = (data?.report.listings.length ?? 0) > 0;
  const hasOrder = (data?.report.orders ?? 0) > 0;

  // Tudo reflete o estado real: loja conectada, anúncio publicado, venda recebida.
  const doneSteps = useMemo(() => {
    const next = new Set<string>();
    if (marketplaceConnected || (data?.connected.length ?? 0) > 0) next.add("connect");
    if (hasListing) next.add("product");
    if (hasOrder || contentDone) next.add("content");
    return next;
  }, [marketplaceConnected, data, hasListing, hasOrder, contentDone]);

  const doneCount = doneSteps.size;
  const progressPct = Math.round((doneCount / ONBOARDING_STEPS.length) * 100);

  const toggleStep = (id: string) => {
    if (id === "content") setContentDone((prev) => !prev);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={name ? `${t(greeting)}, ${name}` : `${t(greeting)}!`}
        description={DESCRIPTION}
        actions={
          <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
            {[7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium",
                  days === d ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                )}
              >
                {d} dias
              </button>
            ))}
          </div>
        }
      />

      <AppNotificationsCard />

      {/* Onboarding — some quando os 3 passos estão feitos */}
      {doneCount < ONBOARDING_STEPS.length && (
        <Reveal>
          <div className="surface-card relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div
                  className="relative grid size-14 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--brand) ${progressPct}%, var(--surface-hover) 0)`,
                  }}
                >
                  <div className="grid size-11 place-items-center rounded-full bg-surface text-[12px] font-semibold text-foreground">
                    {doneCount}/{ONBOARDING_STEPS.length}
                  </div>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">
                    {doneCount === 0 ? "Vamos começar" : "Você já começou"}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {doneCount === ONBOARDING_STEPS.length
                      ? "Tudo pronto — agora é acompanhar e melhorar"
                      : "Falta pouco pra sua loja rodar"}
                  </p>
                </div>
              </div>

              <div className="grid flex-1 gap-2.5 sm:grid-cols-3">
                {ONBOARDING_STEPS.map((step) => {
                  const done = doneSteps.has(step.id);
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border border-border bg-surface-hover/60 px-3 py-2.5",
                        done && "opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        aria-label={done ? "Marcar como pendente" : "Marcar como concluído"}
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors",
                          done && "border-success bg-success text-success-foreground",
                        )}
                      >
                        <Check className="size-3" />
                      </button>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-[12.5px] font-medium text-foreground",
                            done && "line-through",
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button asChild size="sm" className="shrink-0">
                <Link to="/criar-anuncio">
                  Continuar
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      <StoreHealthPanel data={data} error={error} days={days} />
    </div>
  );
}
