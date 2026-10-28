import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/shared/page-header";
import { StoreHealthDetails, useStoreHealth } from "@/components/store-health/store-health-panel";
import {
  InsightsLoading,
  MlQualityList,
  Opportunities,
  StaleListings,
  StoreScores,
  WeeklyTasks,
  useStoreInsights,
} from "@/components/store-health/store-insights-panel";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Tudo sobre a sua loja: tarefas da semana, nota e reputação de cada canal, anúncios pra revisar, oportunidades e o recap de cada semana.";

export const Route = createFileRoute("/_shell/saude-da-loja")({
  head: () => ({
    meta: [{ title: "Saúde da loja · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: SaudeDaLojaPage,
});

function SaudeDaLojaPage() {
  const [days, setDays] = useState(7);
  const { data, error } = useStoreHealth(days);
  const insights = useStoreInsights();
  const ins = insights.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saúde da loja"
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
      {ins ? (
        <>
          <WeeklyTasks data={ins} onChange={insights.setData} />
          <StoreScores data={ins} />
        </>
      ) : (
        <InsightsLoading error={insights.error} />
      )}

      <StoreHealthDetails
        data={data}
        error={error}
        days={days}
        beforeRecap={
          ins && (
            <>
              <StaleListings data={ins} />
              <MlQualityList data={ins} />
              <Opportunities data={ins} />
            </>
          )
        }
      />
    </div>
  );
}
