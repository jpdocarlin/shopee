import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateTestimonialScript } from "@/lib/testimonial-script";
import { generateTikTokCaption } from "@/lib/tiktok-caption";
import type { DemoProduct } from "@/data/demo-products";

type Props = {
  product: DemoProduct | null;
  link: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScriptChange?: (script: string) => void;
};

export function TestimonialScriptModal({
  product,
  link,
  open,
  onOpenChange,
  onScriptChange,
}: Props) {
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionCopied, setCaptionCopied] = useState(false);

  useEffect(() => {
    if (open && product) {
      const next = generateTestimonialScript(product, link);
      setScript(next);
      setCopied(false);
      onScriptChange?.(next);
      setCaption(generateTikTokCaption(product));
      setCaptionCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, link]);

  if (!product) return null;

  const handleRegenerate = () => {
    const next = generateTestimonialScript(product, link);
    setScript(next);
    setCopied(false);
    onScriptChange?.(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.success("Depoimento copiado");
    } catch {
      toast.info("Copie manualmente o texto abaixo");
    }
  };

  const handleRegenerateCaption = () => {
    setCaption(generateTikTokCaption(product));
    setCaptionCopied(false);
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      toast.success("Legenda copiada");
    } catch {
      toast.info("Copie manualmente o texto abaixo");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Script de depoimento"
      description={product.title}
      size="lg"
    >
      <div className="space-y-4">
        {!link && (
          <p className="rounded-lg border border-dashed border-border bg-surface-hover/60 p-3 text-[12px] text-muted-foreground">
            Você ainda não salvou um link de afiliado pra este produto — o texto vem com um espaço
            reservado no lugar do link.
          </p>
        )}

        <Textarea
          readOnly
          value={script}
          rows={7}
          className="text-[12.5px] leading-relaxed"
          onFocus={(e) => e.currentTarget.select()}
        />

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRegenerate}>
            <RefreshCw className="size-4" />
            Gerar outra versão
          </Button>
          <Button className="flex-1 gap-2" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar depoimento
          </Button>
        </div>

        <p className="text-[11.5px] text-muted-foreground">
          Estilo achadinhos: em primeira pessoa, contando o "antes e depois" com o produto. Ajuste
          os detalhes se quiser deixar mais parecido com sua própria experiência antes de postar.
        </p>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-[13px] font-medium text-foreground">Legenda pronta pro TikTok</p>
          <Textarea
            readOnly
            value={caption}
            rows={3}
            className="text-[12.5px] leading-relaxed"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRegenerateCaption}>
              <RefreshCw className="size-3.5" />
              Outra versão
            </Button>
            <Button size="sm" className="flex-1 gap-2" onClick={handleCopyCaption}>
              {captionCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copiar legenda
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
