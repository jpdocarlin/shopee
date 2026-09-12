// Área de Membros — camada isolada do resto do app (sem AppShell/sidebar do
// dashboard principal), mesmo padrão de "rota full-screen própria" já usado
// em /atendimento. Escopo bem restrito a pedido do Jp: só módulos + aulas,
// nada de dashboard/XP/gamificação/comunidade aqui dentro.
import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import membrosCss from "@/styles/membros.css?url";
import { useAuthStore } from "@/stores/auth-store";
import { useCourseTree } from "@/lib/membros";
import { CommandPalette } from "@/components/membros/command-palette";

export const Route = createFileRoute("/membros")({
  head: () => ({
    meta: [{ title: "Área de Membros · Shoppfy" }, { name: "robots", content: "noindex" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: membrosCss },
    ],
  }),
  component: MembrosLayout,
});

function FullScreenLoader() {
  return (
    <div className="membros-scope flex h-screen w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-[var(--mb-text-faint)]" />
    </div>
  );
}

function MembrosLayout() {
  const navigate = useNavigate();
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (initialized && !session) {
      void navigate({ to: "/login" });
    }
  }, [initialized, session, navigate]);

  if (!initialized || !session) {
    return <FullScreenLoader />;
  }

  return <MembrosShell />;
}

function MembrosShell() {
  const { data: modules } = useCourseTree();

  return (
    <div className="membros-scope min-h-screen">
      {modules && <CommandPalette modules={modules} />}
      <Outlet />
    </div>
  );
}
