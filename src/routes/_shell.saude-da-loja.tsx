import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/shared/page-header";
import { StoreHealthDetails, useStoreHealth } from "@/components/store-health/store-health-panel";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Tudo sobre a sua loja: números de cada canal, os anúncios que precisam de revisão, o que vale fazer agora e o recap de cada semana.";

export const Route = createFileRoute("/_shell/saude-da-loja")({
  head: () => ({
    meta: [{ title: "Saúde da loja · Shoppfy" }, { name: "description", content: DESCRIPTION }],
  }),
  component: SaudeDaLojaPage,
});

function SaudeDaLojaPage() {
  const [days, setDays] = useState(7);
  const { data, error } = useStoreHealth(days);

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
      <StoreHealthDetails data={data} error={error} days={days} />
    </div>
  );
}
