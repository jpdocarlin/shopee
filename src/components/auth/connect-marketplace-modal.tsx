import { useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { MarketplaceBadge } from "@/components/products/marketplace-badge";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_META } from "@/data/demo-products";
import { MARKETPLACE_SIGNUP_URL, type Marketplace } from "@/stores/affiliate-store";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MARKETPLACES: Marketplace[] = ["shopee", "mercado-livre"];

export function ConnectMarketplaceModal({ open, onOpenChange }: Props) {
  const [marketplace, setMarketplace] = useState<Marketplace>("shopee");
  const [saving, setSaving] = useState(false);
  const session = useAuthStore((s) => s.session);
  const setMarketplaceConnected = useAuthStore((s) => s.setMarketplaceConnected);

  const meta = MARKETPLACE_META[marketplace];
  const signupUrl = MARKETPLACE_SIGNUP_URL[marketplace];

  const handleConfirm = async () => {
    if (!session?.user) return;
    setSaving(true);

    const { data: mkt, error: mktError } = await supabase
      .from("marketplaces")
      .select("id")
      .eq("slug", marketplace)
      .maybeSingle();

    if (mktError || !mkt) {
      toast.error("Não foi possível conectar agora", {
        description: "Tente novamente em instantes.",
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("marketplace_accounts").insert({
      user_id: session.user.id,
      marketplace_id: mkt.id,
      label: `Conta ${meta.label}`,
      status: "active",
    });

    setSaving(false);

    if (error) {
      toast.error("Não foi possível conectar agora", { description: error.message });
      return;
    }

    setMarketplaceConnected(true);
    toast.success(`Conta ${meta.label} conectada`);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar conta de afiliado"
      description="Esse passo é obrigatório pra liberar as ações do sistema."
      size="md"
    >
      <div className="space-y-5">
        <div className="flex gap-2">
          {MARKETPLACES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMarketplace(m)}
              className={
                "flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors " +
                (marketplace === m
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-card text-muted-foreground hover:border-white/20")
              }
            >
              {MARKETPLACE_META[m].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <MarketplaceBadge marketplace={marketplace} />
          <span className="text-[12px] text-muted-foreground">
            O Shoppfy nunca guarda seus dados de pagamento — a conexão é só o vínculo de afiliado.
          </span>
        </div>

        <div className="flex gap-3 rounded-lg border border-border bg-surface-hover/60 p-3.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
            1
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-foreground">
              Cadastre-se no Programa de Afiliados da {meta.label}
            </p>
            <p className="text-[12px] text-muted-foreground">
              Gratuito, aprova em poucos dias. Precisa de conta ativa, maioridade e uma chave PIX ou
              conta bancária pra receber.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-8 gap-1.5 text-[12.5px]"
              onClick={() => window.open(signupUrl, "_blank", "noopener,noreferrer")}
            >
              Cadastrar agora
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-dashed border-border p-3.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-hover text-[12px] font-semibold text-muted-foreground">
            2
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-foreground">Já concluiu o cadastro?</p>
            <p className="text-[12px] text-muted-foreground">
              Confirme aqui pra liberar o resto do sistema.
            </p>
            <Button
              size="sm"
              className="mt-1 h-8 gap-1.5 text-[12.5px]"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Já me cadastrei
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
