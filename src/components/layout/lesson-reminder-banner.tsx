import { Play } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useCourseTree } from "@/lib/membros";
import { useIsOwner, useIsPedidosAdmin } from "@/lib/owner";

// Banner persistente (não bloqueia, não tem dismiss) que aparece no topo do
// Dashboard pra usuário novo que ainda não assistiu a primeira aula da área
// de membros — mesma linguagem visual do antigo MarketplaceLockGate
// (ícone circular + título + descrição + botão), mas como card inline em vez
// de overlay bloqueante. Ao contrário do WelcomeLessonNudge (modal, uma vez
// por sessão), esse banner volta em toda visita ao Dashboard até a aula ser
// assistida — e não exige marketplace conectado.
export function LessonReminderBanner() {
  const profile = useAuthStore((s) => s.profile);
  const isOwner = useIsOwner();
  const isPedidosAdmin = useIsPedidosAdmin();
  const { data: modules } = useCourseTree();

  const introModule = modules?.[0];
  const introLesson = introModule?.lessons?.[0];

  const eligibleAccount = !isOwner && !isPedidosAdmin;
  const alreadyWatched = !introLesson || introLesson.state === "completed";

  if (!profile?.onboarding_done) return null;
  if (!eligibleAccount) return null;
  if (!introModule || !introLesson) return null;
  if (alreadyWatched) return null;

  return (
    <div className="surface-card flex flex-col items-center gap-3.5 p-5 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
        <Play className="size-5" fill="currentColor" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-foreground">
          Assista a aula rápida antes de continuar
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Preparamos um vídeo curto mostrando como o Shoppfy funciona — vale mais a pena assistir
          agora do que tentar descobrir no susto.
        </p>
      </div>
      <Button asChild size="sm" className="w-full shrink-0 gap-1.5 sm:w-auto">
        <Link
          to="/membros/$moduloSlug/$aulaSlug"
          params={{ moduloSlug: introModule.slug, aulaSlug: introLesson.slug }}
        >
          Assistir agora
          <Play className="size-3.5" fill="currentColor" />
        </Link>
      </Button>
    </div>
  );
}
