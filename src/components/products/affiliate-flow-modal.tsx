import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { MarketplaceBadge } from "./marketplace-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DemoProduct } from "@/data/demo-products";
import { MARKETPLACE_META } from "@/data/demo-products";
import {
  MARKETPLACE_LINK_TOOL_URL,
  MARKETPLACE_SIGNUP_URL,
  useAffiliateStore,
} from "@/stores/affiliate-store";

type Props = {
  product: DemoProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AffiliateFlowModal({ product, open, onOpenChange }: Props) {
  const registered = useAffiliateStore((s) =>
    product ? s.registered[product.marketplace] : false,
  );
  const savedLink = useAffiliateStore((s) => (product ? s.links[product.id] : undefined));
  const setRegistered = useAffiliateStore((s) => s.setRegistered);
  const saveLink = useAffiliateStore((s) => s.saveLink);

  const [linkDraft, setLinkDraft] = useState("");
  const [copiedProductUrl, setCopiedProductUrl] = useState(false);

  useEffect(() => {
    if (open) {
      setLinkDraft(savedLink?.url ?? "");
      setCopiedProductUrl(false);
    }
  }, [open, savedLink]);

  if (!product) return null;

  const meta = MARKETPLACE_META[product.marketplace];
  const signupUrl = MARKETPLACE_SIGNUP_URL[product.marketplace];
  const toolUrl = MARKETPLACE_LINK_TOOL_URL[product.marketplace];

  const handleCopyProductUrl = async () => {
    try {
      await navigator.clipboard.writeText(product.title);
      setCopiedProductUrl(true);
      toast.success("Nome do produto copiado", {
        description: "Cole na busca da ferramenta da " + meta.label,
      });
    } catch {
      toast.info("Copie manualmente o nome do produto", {
        description: product.title,
      });
    }
  };

  const handleOpenTool = () => {
    window.open(toolUrl, "_blank", "noopener,noreferrer");
  };

  const handleSaveLink = () => {
    if (!linkDraft.trim()) {
      toast.error("Cole o link gerado antes de salvar");
      return;
    }
    saveLink(product.id, linkDraft);
    toast.success("Link de afiliado salvo", { description: product.title });
    onOpenChange(false);
  };

  const handleCopySavedLink = async () => {
    if (!savedLink) return;
    try {
      await navigator.clipboard.writeText(savedLink.url);
      toast.success("Link copiado");
    } catch {
      toast.info("Link", { description: savedLink.url });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={registered ? "Pegar meu link de afiliado" : "Virar afiliado deste produto"}
      description={product.title}
      size="md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <MarketplaceBadge marketplace={product.marketplace} />
          <span className="text-[12px] text-muted-foreground">
            O link é gerado direto no site da {meta.label} — o Shoppfy nunca guarda seus dados de
            pagamento.
          </span>
        </div>

        {!registered ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-border bg-surface-hover/60 p-3.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
                1
              </div>
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-foreground">
                  Cadastre-se no Programa de Afiliados da {meta.label}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Gratuito, aprova em poucos dias. Precisa de conta ativa, maioridade e uma chave
                  PIX ou conta bancária pra receber.
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
                  Confirme aqui pra liberar a geração de link direto pelos produtos do Shoppfy.
                </p>
                <Button
                  size="sm"
                  className="mt-1 h-8 gap-1.5 text-[12.5px]"
                  onClick={() => {
                    setRegistered(product.marketplace, true);
                    toast.success(`Conta ${meta.label} conectada`);
                  }}
                >
                  <Check className="size-3.5" />
                  Já me cadastrei
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {savedLink && (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5">
                <PartyPopper className="size-4 shrink-0 text-success" />
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                  Você já tem um link salvo para este produto
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label="Copiar link salvo"
                  onClick={handleCopySavedLink}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}

            <div className="flex gap-3 rounded-lg border border-border bg-surface-hover/60 p-3.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
                1
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-[13px] font-medium text-foreground">Copie o nome do produto</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={product.title}
                    className="h-8 text-[12px]"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="icon"
                    variant={copiedProductUrl ? "secondary" : "outline"}
                    className="size-8 shrink-0"
                    aria-label="Copiar nome do produto"
                    onClick={handleCopyProductUrl}
                  >
                    {copiedProductUrl ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface-hover/60 p-3.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
                2
              </div>
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-foreground">
                  Busque o produto na ferramenta da {meta.label}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Já abre direto na tela de "Oferta de produto" — cole o nome que você copiou na
                  busca e clique em "Obter link" no produto certo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 h-8 gap-1.5 text-[12.5px]"
                  onClick={handleOpenTool}
                >
                  Abrir ferramenta da {meta.label}
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-surface-hover/60 p-3.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
                3
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label
                  htmlFor="affiliate-link-input"
                  className="text-[13px] font-medium text-foreground"
                >
                  Cole aqui o link de afiliado gerado
                </Label>
                <Input
                  id="affiliate-link-input"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://..."
                  className="h-9 text-[12.5px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveLink();
                  }}
                />
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleSaveLink}>
              <Link2 className="size-4" />
              Salvar link deste produto
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
