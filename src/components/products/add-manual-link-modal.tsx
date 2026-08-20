import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { MarketplaceBadge } from "./marketplace-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MARKETPLACE_META } from "@/data/demo-products";
import { useAffiliateStore, type Marketplace } from "@/stores/affiliate-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MARKETPLACES: Marketplace[] = ["shopee", "mercado-livre"];

function makeManualId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `manual-${random}`;
}

// Pra produtos que a pessoa já divulga mas que não estão no catálogo do
// Shoppfy nem foram capturados pela extensão — cola o link aqui uma vez e ele
// fica salvo em Meus Links pra sempre (mesmo localStorage persistido usado
// pelos links do catálogo e da extensão).
export function AddManualLinkModal({ open, onOpenChange }: Props) {
  const saveLink = useAffiliateStore((s) => s.saveLink);

  const [title, setTitle] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace>("shopee");
  const [url, setUrl] = useState("");

  const reset = () => {
    setTitle("");
    setMarketplace("shopee");
    setUrl("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      toast.error("Dá um nome pro produto antes de salvar");
      return;
    }
    if (!trimmedUrl) {
      toast.error("Cole o link de afiliado antes de salvar");
      return;
    }

    saveLink(makeManualId(), trimmedUrl, {
      title: trimmedTitle,
      marketplace,
      source: "manual",
    });

    toast.success("Link salvo", { description: trimmedTitle });
    handleOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Adicionar link de afiliado"
      description="Pra produtos que você já divulga e não estão no Shoppfy. Fica salvo aqui pra sempre."
      size="md"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="manual-link-title" className="text-[13px] font-medium text-foreground">
            Nome do produto
          </Label>
          <Input
            id="manual-link-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Fone de ouvido bluetooth"
            className="h-9 text-[12.5px]"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[13px] font-medium text-foreground">Marketplace</Label>
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
          <div className="flex items-center gap-2 pt-0.5">
            <MarketplaceBadge marketplace={marketplace} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="manual-link-url" className="text-[13px] font-medium text-foreground">
            Link de afiliado
          </Label>
          <Input
            id="manual-link-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-9 text-[12.5px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>

        <Button className="w-full gap-2" onClick={handleSave}>
          <Link2 className="size-4" />
          Salvar link
        </Button>
      </div>
    </Modal>
  );
}
