import { Coins, Package, Percent, TrendingUp } from "lucide-react";

import { StaggerItem } from "@/components/motion/reveal";
import type { DemoProduct } from "@/data/demo-products";
import { formatBRL, formatPercent } from "@/lib/format";

export function ProductStats({ products }: { products: DemoProduct[] }) {
  const count = products.length || 1;
  const avgCommission =
    products.reduce((a, p) => a + p.commissionRate, 0) / count;
  const avgTicket = products.reduce((a, p) => a + p.priceCents, 0) / count;
  const topScore = products.reduce((a, p) => Math.max(a, p.score), 0);

  const items = [
    { icon: Package, label: "Produtos disponíveis", value: String(products.length) },
    { icon: Percent, label: "Comissão média", value: formatPercent(avgCommission) },
    { icon: Coins, label: "Ticket médio", value: formatBRL(Math.round(avgTicket)) },
    { icon: TrendingUp, label: "Melhor score", value: String(topScore) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <StaggerItem
          key={item.label}
          className="rounded-xl border border-border bg-card p-4 shadow-soft transition-colors duration-200 hover:border-white/15"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <item.icon className="size-3.5" />
            <span className="text-[11.5px] uppercase tracking-wide">
              {item.label}
            </span>
          </div>
          <p className="mt-2 text-[20px] font-semibold tracking-tight tabular-nums text-foreground">
            {item.value}
          </p>
        </StaggerItem>
      ))}
    </div>
  );
}