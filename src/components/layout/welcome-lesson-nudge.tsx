import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Play } from "lucide-react";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { formatDurationShort, useCourseTree } from "@/lib/membros";
import { useIsOwner, useIsPedidosAdmin } from "@/lib/owner";

const DISMISS_KEY_PREFIX = "shoppfy.welcome-lesson-dismissed.";

// Aparece uma única vez por sessão de navegador pra quem ainda não assistiu
// a primeiríssima aula da área de membros ("Como funciona o Shoppfy") — o
// objetivo é puxar gente nova pra aula antes de sair clicando no resto do
// app sem contexto. Fica de fora pra contas internas (dono/pedidos_admin,
// que não são afiliados de verdade) e só dispara depois que o
// MarketplaceLockGate já liberou o app, pra nunca empilhar modal em cima de
// modal.
export function WelcomeLessonNudge() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const marketplaceConnected = useAuthStore((s) => s.marketplaceConnected);
  const isOwner = useIsOwner();
  const isPedidosAdmin = useIsPedidosAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const { data: modules } = useCourseTree();
  const introModule = modules?.[0];
  const introLesson = introModule?.lessons?.[0];

  const [open, setOpen] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  const userId = session?.user.id ?? null;
  const eligibleAccount = !isOwner && !isPedidosAdmin;

  useEffect(() => {
    if (hasEvaluated) return;
    if (!userId || !profile?.onboarding_done) return;
    if (!eligibleAccount) return;
    if (marketplaceConnected !== true) return;
    if (pathname.startsWith("/membros") || pathname === "/configuracoes") return;
    if (modules === undefined) return;

    setHasEvaluated(true);

    const alreadyWatched = !introLesson || introLesson.state === "completed";
    const dismissed = sessionStorage.getItem(DISMISS_KEY_PREFIX + userId) === "1";
    if (alreadyWatched || dismissed) return;

    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [
    hasEvaluated,
    userId,
    profile?.onboarding_done,
    eligibleAccount,
    marketplaceConnected,
    pathname,
    modules,
    introLesson,
  ]);

  function dismiss() {
    if (userId) sessionStorage.setItem(DISMISS_KEY_PREFIX + userId, "1");
    setOpen(false);
  }

  function watchNow() {
    if (userId) sessionStorage.setItem(DISMISS_KEY_PREFIX + userId, "1");
    setOpen(false);
    if (introModule && introLesson) {
      void navigate({
        to: "/membros/$moduloSlug/$aulaSlug",
        params: { moduloSlug: introModule.slug, aulaSlug: introLesson.slug },
      });
    }
  }

  if (!eligibleAccount || !introModule || !introLesson) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : dismiss())}
      title="Antes de começar"
      description="Preparamos uma aula rápida mostrando como o Shoppfy funciona — vale mais a pena assistir agora do que tentar descobrir no susto."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={dismiss} className="text-muted-foreground">
            Agora não
          </Button>
          <Button onClick={watchNow} className="gap-1.5">
            Assistir agora
            <Play className="size-3.5" fill="currentColor" />
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface-hover/60 p-3.5">
        <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand/25 to-brand/5 text-brand">
          <Play className="size-5" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {introModule.title}
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-medium text-foreground">
            {introLesson.title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {formatDurationShort(introLesson.duration_seconds)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
