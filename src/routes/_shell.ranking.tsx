import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Crown, Medal, TrendingUp, Trophy } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PERIOD_LABELS, PERIOD_STATS, type DashboardPeriod } from "@/data/demo-dashboard";
import { OTHER_SELLERS } from "@/data/demo-ranking";
import { formatBRL, formatCompact } from "@/lib/format";
import { getInitials, useProfileStore } from "@/stores/profile-store";
import { useIsOwner } from "@/lib/owner";
import { cn } from "@/lib/utils";

const PERIODS: DashboardPeriod[] = ["today", "7d", "30d"];

export const Route = createFileRoute("/_shell/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking · Shoppfy" },
      {
        name: "description",
        content: "Quem mais vende dentro do Shoppfy, por período.",
      },
      { property: "og:title", content: "Ranking · Shoppfy" },
      {
        property: "og:description",
        content: "Quem mais vende dentro do Shoppfy, por período.",
      },
    ],
  }),
  component: RankingPage,
});

type RankedRow = {
  id: string;
  name: string;
  topCategory?: string;
  sales: number;
  revenueCents: number;
  isYou: boolean;
};

const MEDALS = [
  { Icon: Crown, className: "text-warning" },
  { Icon: Trophy, className: "text-muted-foreground" },
  { Icon: Medal, className: "text-muted-foreground/70" },
];

function RankingPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const profileName = useProfileStore((s) => s.name);
  // Ranking é feito 100% de dados de demonstração (o "resto" dos afiliados é
  // fictício) — só a conta do dono enxerga esse conteúdo. Qualquer outra
  // conta vê um estado vazio, sem competidores inventados nem vendas fake.
  const isOwner = useIsOwner();

  const ranking = useMemo<RankedRow[]>(() => {
    if (!isOwner) return [];
    const you: RankedRow = {
      id: "you",
      name: profileName || "Você",
      sales: PERIOD_STATS[period].sales,
      revenueCents: PERIOD_STATS[period].earningsCents,
      isYou: true,
    };
    const others: RankedRow[] = OTHER_SELLERS.map((seller) => ({
      id: seller.id,
      name: seller.name,
      topCategory: seller.topCategory,
      sales: seller.sales[period],
      revenueCents: seller.revenueCents[period],
      isYou: false,
    }));
    return [...others, you].sort((a, b) => b.sales - a.sales || b.revenueCents - a.revenueCents);
  }, [period, profileName, isOwner]);

  const yourPosition = ranking.findIndex((row) => row.isYou) + 1;
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Ranking"
        description="Quem mais vende dentro do Shoppfy, por período — compare seu desempenho com o dos outros afiliados."
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-hover/60 p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  period === p
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        }
        meta={
          isOwner ? (
            <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <TrendingUp className="size-3.5 text-brand" />
              Sua posição: <span className="font-semibold text-foreground">
                #{yourPosition}
              </span> de {ranking.length}
            </p>
          ) : undefined
        }
      />

      {!isOwner ? (
        <EmptyState
          icon={Trophy}
          title="Você ainda não tem vendas"
          description="Assim que suas vendas começarem a entrar, você aparece no ranking dos afiliados."
        />
      ) : (
        <>
          <Stagger className="grid gap-3 sm:grid-cols-3">
            {podium.map((row, index) => {
              const medal = MEDALS[index];
              return (
                <StaggerItem key={row.id}>
                  <div
                    className={cn(
                      "surface-card flex flex-col items-center gap-2 p-5 text-center",
                      row.isYou && "border-brand/50 bg-brand/5",
                    )}
                  >
                    <medal.Icon className={cn("size-6", medal.className)} />
                    <Avatar className="size-14 border border-border">
                      <AvatarFallback className="bg-surface-hover text-[15px] font-medium text-foreground">
                        {getInitials(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[13.5px] font-medium text-foreground">
                        {row.name}
                        {row.isYou && <span className="text-brand"> (Você)</span>}
                      </p>
                      {row.topCategory && (
                        <p className="text-[11.5px] text-muted-foreground">{row.topCategory}</p>
                      )}
                    </div>
                    <div className="mt-1">
                      <p className="text-[18px] font-semibold tracking-tight text-foreground">
                        {formatCompact(row.sales)} vendas
                      </p>
                      <p className="text-[12.5px] text-success">{formatBRL(row.revenueCents)}</p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>

          <Reveal className="surface-card overflow-hidden">
            <div className="divide-y divide-border">
              {rest.map((row, index) => {
                const position = index + 4;
                return (
                  <div
                    key={row.id}
                    className={cn("flex items-center gap-4 px-5 py-3.5", row.isYou && "bg-brand/5")}
                  >
                    <span className="w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums text-muted-foreground">
                      {position}
                    </span>
                    <Avatar className="size-9 border border-border">
                      <AvatarFallback className="bg-surface-hover text-[12px] font-medium text-foreground">
                        {getInitials(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {row.name}
                        {row.isYou && <span className="text-brand"> (Você)</span>}
                      </p>
                      {row.topCategory && (
                        <p className="text-[11.5px] text-muted-foreground">{row.topCategory}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-foreground">
                        {formatCompact(row.sales)} vendas
                      </p>
                      <p className="text-[11.5px] tabular-nums text-success">
                        {formatBRL(row.revenueCents)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <p className="text-[12px] text-muted-foreground">
            MVP com dados de demonstração. O ranking real passa a refletir as vendas de todos os
            afiliados assim que a ingestão de pedidos estiver ligada no app.
          </p>
        </>
      )}
    </div>
  );
}
