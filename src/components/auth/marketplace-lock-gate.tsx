import { useState } from "react";
import { Lock } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ConnectMarketplaceModal } from "./connect-marketplace-modal";

// Cobre só a área de conteúdo (não a sidebar) enquanto a conta de afiliado não
// estiver conectada: dá pra ver tudo por trás, mas nenhum clique passa —
// exceto o botão "Conectar agora", que abre o modal de conexão real.
//
// Fica de fora em /configuracoes: o primeiro passo obrigatório é editar o
// perfil (nome + e-mail) e isso não pode ficar bloqueado esperando a conexão
// do marketplace — a ordem certa é perfil primeiro, Shopee/ML depois.
export function MarketplaceLockGate() {
  const marketplaceConnected = useAuthStore((s) => s.marketplaceConnected);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [modalOpen, setModalOpen] = useState(false);

  if (marketplaceConnected !== false) return null;
  if (pathname === "/configuracoes") return null;

  return (
    <>
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
        <div className="surface-card mx-4 max-w-sm space-y-3 p-5 text-center shadow-lg">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-brand/15 text-brand">
            <Lock className="size-5" />
          </div>
          <p className="text-[14px] font-medium text-foreground">Conecte sua conta pra continuar</p>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Dá pra ver tudo por aqui, mas as ações do sistema só liberam depois que você conectar
            sua conta de afiliado Shopee ou Mercado Livre.
          </p>
          <Button onClick={() => setModalOpen(true)} className="w-full">
            Conectar agora
          </Button>
        </div>
      </div>
      <ConnectMarketplaceModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
