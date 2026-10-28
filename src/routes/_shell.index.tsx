import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/shared/page-header";
import { StoreNumbers, useStoreHealth } from "@/components/store-health/store-health-panel";
import { getGreeting } from "@/lib/greeting";
import { useProfileStore } from "@/stores/profile-store";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/translations";

const DESCRIPTION = "Os números das suas lojas: visitas, vendas, lucro e conversão.";

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

function IndexPage() {
  const t = useT();
  const name = useProfileStore((s) => s.name);
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [days, setDays] = useState(7);
  const { data, error } = useStoreHealth(days);

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

      <StoreNumbers data={data} error={error} days={days} />
    </div>
  );
}
