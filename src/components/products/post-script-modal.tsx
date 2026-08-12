import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ImageIcon, Package2, RefreshCw, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildFallbackStory,
  buildStoryPost,
  generatePostScript,
  type PostScriptProduct,
  type ScriptTone,
} from "@/lib/post-script";
import { generateEnhancedProductPhoto } from "@/lib/gemini-image.functions";
import { generateProductStory } from "@/lib/gemini-text.functions";

// Cache em memória (sobrevive a fechar/reabrir o modal, some só ao recarregar
// a página) — evita gastar cota da IA gerando a mesma foto de novo toda vez
// que o usuário reabre o post do mesmo produto.
const enhancedPhotoCache = new Map<string, string>();

async function imageUrlToPngBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  const blob = await res.blob();
  if (blob.type === "image/png") return blob;

  // Reencoda pra PNG — é o único formato de imagem com suporte garantido
  // na Clipboard API dos navegadores.
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado nesse navegador.");
  ctx.drawImage(bitmap, 0, 0);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter a imagem."))),
      "image/png",
    );
  });
}

// Produto do catálogo tem todos os campos de PostScriptProduct; um produto
// salvo pela extensão do Chrome (fora do catálogo) só tem título e, na
// maioria das vezes, imagem — por isso a imagem também é opcional aqui.
type ModalProduct = PostScriptProduct & { image?: string; category?: string };

type Props = {
  product: ModalProduct | null;
  link: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TONES: { id: ScriptTone; label: string }[] = [
  { id: "historia", label: "Mini história" },
  { id: "emoji", label: "Curto" },
  { id: "direto", label: "Direto" },
];

export function PostScriptModal({ product, link, open, onOpenChange }: Props) {
  const [tone, setTone] = useState<ScriptTone>("historia");
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  // O Facebook, quando recebe foto + texto juntos no clipboard, só aceita a
  // foto e descarta o texto — então o fluxo vira 2 passos no mesmo botão:
  // 1º clique copia a foto, 2º clique (depois de colar a foto) copia o texto.
  const [flowStep, setFlowStep] = useState<"foto" | "texto">("foto");
  // Foto refeita pela IA em qualidade de catálogo, a partir da foto original
  // do produto — gerada automaticamente assim que o modal abre.
  const [enhancedPhoto, setEnhancedPhoto] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const generatePhoto = useServerFn(generateEnhancedProductPhoto);
  const requestIdRef = useRef(0);

  // Mini-história escrita pela IA a partir do produto real — é o corpo do post.
  const [story, setStory] = useState<string | null>(null);
  const [storyStatus, setStoryStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const generateStory = useServerFn(generateProductStory);
  const storyRequestIdRef = useRef(0);
  const storyVariantRef = useRef(0);

  useEffect(() => {
    if (open) {
      setTone("historia");
      setCopiedText(false);
      setCopiedImage(false);
      setFlowStep("foto");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !product?.image) {
      setEnhancedPhoto(null);
      setPhotoStatus("idle");
      return;
    }

    const cached = enhancedPhotoCache.get(product.image);
    if (cached) {
      setEnhancedPhoto(cached);
      setPhotoStatus("done");
      return;
    }

    const requestId = ++requestIdRef.current;
    setEnhancedPhoto(null);
    setPhotoStatus("generating");

    generatePhoto({
      data: { title: product.title, category: product.category, productImageUrl: product.image },
    })
      .then((result) => {
        if (requestIdRef.current !== requestId) return; // modal trocou de produto enquanto gerava
        enhancedPhotoCache.set(product.image as string, result.dataUrl);
        setEnhancedPhoto(result.dataUrl);
        setPhotoStatus("done");
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        console.error("[PostScriptModal] falha ao gerar foto melhorada:", err);
        setPhotoStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.image, product?.title, product?.category]);

  // Só roda no clique em "Reescrever com IA" — cada clique pede uma variação
  // diferente da história pro modelo.
  const runStoryGeneration = useCallback(
    (target: ModalProduct) => {
      storyVariantRef.current += 1;
      const requestId = ++storyRequestIdRef.current;
      setStoryStatus("generating");

      generateStory({
        data: {
          title: target.title,
          category: target.category,
          priceCents: target.priceCents,
          originalPriceCents: target.originalPriceCents,
          variant: storyVariantRef.current,
        },
      })
        .then((result) => {
          if (storyRequestIdRef.current !== requestId) return; // trocou de produto no meio
          setStory(result.story);
          setStoryStatus("done");
        })
        .catch((err) => {
          if (storyRequestIdRef.current !== requestId) return;
          console.error("[PostScriptModal] falha ao gerar história:", err);
          // Volta pro texto local — o usuário nunca fica sem post por causa da IA.
          setStory(null);
          setStoryStatus("error");
        });
    },
    [generateStory],
  );

  // Ao abrir, NÃO chama a IA: mostra na hora a história montada localmente, que
  // segue o formato certo e cita o produto. A IA só entra quando o usuário
  // clica em "Outra história" — antes ela sobrescrevia o texto bom por um pior
  // alguns segundos depois de abrir o modal.
  useEffect(() => {
    setStory(null);
    setStoryStatus("idle");
    storyVariantRef.current = 0;
    storyRequestIdRef.current += 1; // descarta resposta de um produto anterior
  }, [open, product?.title]);

  const script = useMemo(() => {
    if (!product) return "";
    if (tone !== "historia") return generatePostScript(product, { link, tone });
    // Enquanto a IA escreve, mostra o fallback local pra caixa nunca ficar vazia.
    return buildStoryPost(story ?? buildFallbackStory(product), link);
  }, [product, link, tone, story]);

  if (!product) return null;

  const photoToCopy = enhancedPhoto ?? product.image;
  const isGeneratingPhoto = photoStatus === "generating";
  const isWritingStory = tone === "historia" && storyStatus === "generating";

  const handleCopyText = async () => {
    if (isWritingStory) {
      toast.info("A IA ainda está escrevendo a história — só um instante");
      return;
    }
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

  const handlePhotoTextFlow = async () => {
    if (!product.image) {
      await handleCopyText();
      return;
    }

    if (flowStep === "foto") {
      if (isGeneratingPhoto) {
        toast.info("Ainda gerando a foto em qualidade melhor — só um instante");
        return;
      }
      try {
        const blob = await imageUrlToPngBlob(photoToCopy as string);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setFlowStep("texto");
        toast.success("1/2 · Foto copiada", {
          description:
            "Cole (Ctrl+V) no post do grupo — depois clique aqui de novo pra copiar o texto",
        });
      } catch {
        // Navegador sem suporte, ou a imagem é de um domínio que bloqueia CORS.
        toast.info(
          'Não deu pra copiar a foto (bloqueio do navegador ou do site) — use "Link da imagem" abaixo.',
        );
      }
      return;
    }

    if (isWritingStory) {
      toast.info("A IA ainda está escrevendo a história — só um instante");
      return;
    }

    try {
      await navigator.clipboard.writeText(script);
      setFlowStep("foto");
      toast.success("2/2 · Texto copiado", {
        description: "Cole (Ctrl+V) embaixo da foto pra completar o post",
      });
    } catch {
      toast.info("Copie manualmente o texto abaixo");
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
            <div className="relative size-16 shrink-0">
              <img
                src={photoToCopy}
                alt={product.title}
                className="size-16 rounded-lg border border-border object-cover"
              />
              {isGeneratingPhoto && (
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/80">
                  <Sparkles className="size-4 animate-pulse text-brand" />
                </div>
              )}
            </div>
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-muted-foreground">
              <Package2 className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{product.title}</p>
            {product.image && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[11.5px]"
                  onClick={handleCopyImageUrl}
                >
                  {copiedImage ? <Check className="size-3" /> : <ImageIcon className="size-3" />}
                  Link da imagem original
                </Button>
                {photoStatus === "done" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3 text-brand" />
                    Foto melhorada pela IA
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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

          {tone === "historia" && (
            <div className="ml-auto flex items-center gap-1">
              {story && !isWritingStory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11.5px]"
                  onClick={() => {
                    storyRequestIdRef.current += 1;
                    setStory(null);
                    setStoryStatus("idle");
                  }}
                >
                  Voltar ao original
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-[11.5px]"
                onClick={() => runStoryGeneration(product)}
                disabled={isWritingStory}
              >
                <RefreshCw className={cn("size-3", isWritingStory && "animate-spin")} />
                {isWritingStory ? "Escrevendo…" : "Reescrever com IA"}
              </Button>
            </div>
          )}
        </div>

        <div className="relative">
          <Textarea
            readOnly
            value={script}
            rows={9}
            className={cn(
              "text-[12.5px] leading-relaxed",
              isWritingStory && "text-muted-foreground",
            )}
            onFocus={(e) => e.currentTarget.select()}
          />
          {isWritingStory && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 animate-pulse text-brand" />
              IA escrevendo a história…
            </span>
          )}
        </div>

        {tone === "historia" && storyStatus === "error" && (
          <p className="text-[11.5px] text-muted-foreground">
            A IA não respondeu agora — o texto abaixo é o original, que já está pronto pra colar.
          </p>
        )}

        <Button
          className="w-full gap-2"
          onClick={handlePhotoTextFlow}
          disabled={Boolean(product.image) && flowStep === "foto" && isGeneratingPhoto}
        >
          {!product.image ? (
            <Copy className="size-4" />
          ) : flowStep === "foto" && isGeneratingPhoto ? (
            <Sparkles className="size-4 animate-pulse" />
          ) : flowStep === "foto" ? (
            <ImageIcon className="size-4" />
          ) : (
            <Type className="size-4" />
          )}
          {product.image
            ? flowStep === "foto"
              ? isGeneratingPhoto
                ? "Gerando foto em qualidade melhor…"
                : "1. Copiar foto"
              : "2. Copiar texto"
            : "Copiar texto do post"}
        </Button>

        {product.image && (
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCopyText}>
            {copiedText ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copiar só o texto
          </Button>
        )}

        <p className="text-[11.5px] text-muted-foreground">
          {product.image
            ? flowStep === "foto"
              ? isGeneratingPhoto
                ? "A IA está refazendo a foto do produto em qualidade de catálogo, parecida com a original só que mais nítida — alguns segundos."
                : 'O Facebook não aceita foto + texto colados juntos, então são 2 cliques: clique em "1. Copiar foto", cole (Ctrl+V) no post do grupo — o botão vira "2. Copiar texto" pra você colar embaixo.'
              : 'Foto copiada. Cole (Ctrl+V) no post do grupo e depois clique em "2. Copiar texto" pra colar a legenda embaixo.'
            : "Vídeo e imagem gerados por IA ainda não estão disponíveis — por enquanto o post usa a foto original do produto."}
        </p>
      </div>
    </Modal>
  );
}
