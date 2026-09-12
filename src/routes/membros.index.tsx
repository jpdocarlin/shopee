import { createFileRoute, Link } from "@tanstack/react-router";
import { Command } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { ModuleCard } from "@/components/membros/module-card";
import { ModuleCardSkeleton } from "@/components/membros/skeletons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { useCourseTree, type EnrichedModule } from "@/lib/membros";

export const Route = createFileRoute("/membros/")({
  component: MembrosHome,
});

function pickFeatured(modules: EnrichedModule[]): string | null {
  const inProgress = modules.find((m) => m.state === "in_progress");
  if (inProgress) return inProgress.id;
  const available = modules.find((m) => m.state === "available");
  if (available) return available.id;
  return modules[0]?.id ?? null;
}

function MembrosHome() {
  const { data: modules, isLoading } = useCourseTree();
  const featuredId = modules ? pickFeatured(modules) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <header className="mb-12 flex items-center justify-between sm:mb-16">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="mb-heading text-[15px]">Shoppfy</span>
        </div>
        <button
          type="button"
          onClick={() =>
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
          className="mb-btn-ghost hidden text-[12px] sm:inline-flex"
        >
          <Command className="size-3.5" />
          Buscar
          <kbd className="ml-1 rounded border border-[var(--mb-border)] px-1.5 py-0.5 text-[10px]">
            ⌘K
          </kbd>
        </button>
      </header>

      <Reveal variant="up" className="mb-10 sm:mb-12">
        <p className="mb-eyebrow">Área de Membros</p>
        <h1 className="mb-heading mt-3 text-[30px] sm:text-[38px]">Seus módulos</h1>
        <p className="mt-2 max-w-lg text-[14px] mb-body-muted">
          Escolha um módulo pra continuar. Cada aula libera a próxima assim que você termina — é só
          ir seguindo em ordem.
        </p>
      </Reveal>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <ModuleCardSkeleton featured />
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
        </div>
      )}

      {modules && (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" stagger={0.08}>
          {modules.map((module) => (
            <StaggerItem key={module.id}>
              <ModuleCard module={module} featured={module.id === featuredId} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
