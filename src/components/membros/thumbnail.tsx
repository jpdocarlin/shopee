import { Lock, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LessonState } from "@/lib/membros";

// Sem thumbnails reais ainda (nenhuma aula foi gravada) — em vez de um
// placeholder genérico quebrado, a "arte" é o próprio número da aula em
// tipografia grande sobre um gradiente grafite. Fica premium mesmo sem
// nenhum asset de imagem.
export function Thumbnail({
  number,
  state,
  className,
  size = "md",
}: {
  number: string;
  state: LessonState;
  className?: string;
  size?: "sm" | "md";
}) {
  const locked = state === "locked";
  return (
    <div className={cn("mb-thumb aspect-video", className)}>
      <div className={cn("mb-thumb-number", size === "sm" ? "text-2xl" : "text-4xl sm:text-5xl")}>
        {number}
      </div>

      {!locked && (
        <div className="mb-thumb-play">
          <div className="mb-thumb-play-circle">
            <Play className="ml-0.5 size-4" fill="currentColor" />
          </div>
        </div>
      )}

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Lock className="size-4 text-white/35" />
        </div>
      )}
    </div>
  );
}
