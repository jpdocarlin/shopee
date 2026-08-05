import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import { Stagger, StaggerItem } from "@/components/motion/reveal";

type Props = {
  icon: LucideIcon;
  title: string;
  summary: string;
  capabilities: string[];
};

export function ModulePlaceholder({
  icon: Icon,
  title,
  summary,
  capabilities,
}: Props) {
  return (
    <Stagger stagger={0.06} delay={0.05} className="space-y-6">
      <StaggerItem>
        <div className="surface-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-hover text-brand">
              <Icon className="size-5" />
            </span>
            <div className="space-y-1.5">
              <p className="text-[15px] font-medium text-foreground">{title}</p>
              <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {summary}
              </p>
            </div>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => (
            <div
              key={capability}
              className="hover-surface group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 shadow-soft"
            >
              <span className="text-[13px] text-foreground/90">{capability}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
            </div>
          ))}
        </div>
      </StaggerItem>

      <StaggerItem>
        <p className="text-[12px] text-muted-foreground">
          Módulo estruturado — a implementação funcional entra na próxima etapa.
        </p>
      </StaggerItem>
    </Stagger>
  );
}