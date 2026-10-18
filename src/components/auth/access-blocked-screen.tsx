import { useNavigate } from "@tanstack/react-router";
import { Headset, Lock, LogOut, RefreshCw } from "lucide-react";

import { BrandWordmark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_BLOCK_MESSAGES,
  DEFAULT_ACCESS_BLOCK_MESSAGE,
  RENEW_CHECKOUT_URL,
  type AccessBlockReason,
} from "@/lib/access";

// Tela no lugar do app quando a conta está sem acesso (mensal não pago,
// cancelado depois do período pago, reembolso ou chargeback). Não apaga
// nada: assim que o pagamento cai, o webhook libera e a pessoa volta de onde parou.
export function AccessBlockedScreen({ reason }: { reason: string | null }) {
  const navigate = useNavigate();
  const message =
    (reason && ACCESS_BLOCK_MESSAGES[reason as AccessBlockReason]) || DEFAULT_ACCESS_BLOCK_MESSAGE;
  const canRenew = reason !== "chargeback";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandWordmark />
        </div>

        <div className="surface-card space-y-5 p-6">
          <div className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="size-5" />
          </div>

          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-foreground">
              {message.title}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              {message.body}
            </p>
          </div>

          <div className="space-y-2.5">
            {canRenew && (
              <Button asChild className="w-full gap-2">
                <a href={RENEW_CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                  <RefreshCw className="size-4" />
                  Renovar meu plano
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full gap-2">
              <a href="/atendimento">
                <Headset className="size-4" />
                Falar com o suporte
              </a>
            </Button>
          </div>

          <p className="text-[12px] text-muted-foreground">
            Já pagou? O acesso volta sozinho em alguns minutos — é só recarregar esta página.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mx-auto mt-5 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
