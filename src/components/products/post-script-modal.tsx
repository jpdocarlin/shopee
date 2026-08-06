import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ImageIcon, Package2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { generatePostScript, type PostScriptProduct, type ScriptTone } from "@/lib/post-script";

// Produto do catálogo tem todos os campos de PostScriptProduct; um produto
// salvo pela extensão do Chrome (fora do catálogo) só tem título e, na
// maioria das vezes, imagem — por isso a imagem também é opcional aqui.
type ModalProduct = PostScriptProduct & { image?: string };

type Props = {
  product: ModalProduct | null;
  link: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TONES: { id: ScriptTone; label: string }[] = [
  { id: "emoji", label: "Casual" },
  { id: "direto", label: "Direto" },
];

export function PostScriptModal({ product, link, open, onOpenChange }: Props) {
  const [tone, setTone] = useState<ScriptTone>("emoji");
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  useEffect(() => {
    if (open) {
      setTone("emoji");
      setCopiedText(false);
      setCopiedImage(false);
    }
  }, [open]);

  const script = useMemo(
    () => (product ? generatePostScript(product, { link, tone }) : ""),
    [product, link, tone],
  );

  if (!product) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopiedText(true);
      toast.success("Texto copiado", { description: "Já pode colar no grupo" });
    } catch {
      toast.info("Copie manualmente o texto abaixo");
    }
  };

  const handleCopyImageUrl = async () => {
    if (!product.image) return;
    try {
      await navigator.clipboard.writeText(product.image);
      setCopiedImage(true);
      toast.success("Link da imagem copiado");
    } catch {
      toast.info("Copie manualmente o link da imagem");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Post pronto pra divulgar"
      description={product.title}
      size="lg"
    >
      <div className="space-y-4">
        {!link && (
          <p className="rounded-lg border border-dashed border-border bg-surface-hover/60 p-3 text-[12px] text-muted-foreground">
            Você ainda não salvou um link de afiliado pra este produto — o texto abaixo vem com um
            espaço reservado. Gere o link em "Produtos" e volte aqui pra ter o script completo.
          </p>
        )}

        <div className="flex items-center gap-3">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="size-16 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-muted-foreground">
              <Package2 className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{product.title}</p>
            {product.image && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1.5 h-7 gap-1.5 text-[11.5px]"
                onClick={handleCopyImageUrl}
              >
                {copiedImage ? <Check className="size-3" /> : <ImageIcon className="size-3" />}
                Copiar imagem do produto
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                tone === t.id
                  ? "border-transparent bg-surface-hover text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Textarea
          readOnly
          value={script}
          rows={7}
          className="text-[12.5px] leading-relaxed"
          onFocus={(e) => e.currentTarget.select()}
        />

        <Button className="w-full gap-2" onClick={handleCopyText}>
          {copiedText ? <Check className="size-4" /> : <Copy className="size-4" />}
          Copiar texto do post
        </Button>

        <p className="text-[11.5px] text-muted-foreground">
          Vídeo e imagem gerados por IA ainda não estão disponíveis — por enquanto o post usa a foto
          original do produto. Cole o texto e a imagem direto no grupo.
        </p>
      </div>
    </Modal>
  );
}
