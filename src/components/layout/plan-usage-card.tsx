import { motion } from "motion/react";
import { Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PlanUsageCard() {
  const used = 62;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-soft">
      <div className="flex items-center gap-2">
        <Zap className="size-3.5 text-brand" />
        <span className="text-[12px] font-medium text-foreground">Plano Pro</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{used}% das buscas mensais usadas</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${used}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <Button variant="outline" size="sm" className="mt-3 h-7 w-full text-[12px]">
        Fazer upgrade
      </Button>
    </div>
  );
}
