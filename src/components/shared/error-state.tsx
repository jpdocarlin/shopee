import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Algo deu errado",
  description = "Não conseguimos carregar estes dados. Tente novamente em instantes.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-14 text-center shadow-soft",
        className,
      )}
    >
      <span className="mb-4 grid size-11 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Tentar novamente
        </Button>
      )}
    </Reveal>
  );
}