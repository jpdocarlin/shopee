import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Copy,
  Download,
  ExternalLink,
  Facebook,
  ImageIcon,
  Loader2,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductPicker } from "@/components/ia/product-picker";
import { TestimonialScriptModal } from "@/components/ia/testimonial-script-modal";
import { VideoScenesTab } from "@/components/ia/video-scenes-tab";
import { type DemoProduct } from "@/data/demo-products";
import { generateProductPhoto } from "@/lib/gemini-image.functions";
import { getSuggestedGroups } from "@/lib/product-groups";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useT } from "@/i18n/translations";

export const Route = createFileRoute("/_shell/ia")({
  head: () => ({
    meta: [
      { title: "IA · Shoppfy" },
      {
        name: "description",
        content: "Gere foto, vídeo e script de divulgação a partir de um produto.",
      },
      { property: "og:title", content: "IA · Shoppfy" },
      {
        property: "og:description",
        content: "Gere foto, vídeo e script de divulgação a partir de um produto.",
      },
    ],
  }),
  component: IaPage,
});

type MediaType = "foto" | "video";
type GenStatus = "idle" | "generating" | "done";

async function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
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

function FotoScriptTab() {
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [lastScript, setLastScript] = useState("");

  const links = useAffiliateStore((s) => s.links);
  const generatePhoto = useServerFn(generateProductPhoto);

  const groupsInfo = useMemo(
    () => (selected ? getSuggestedGroups(selected.category) : null),
    [selected],
  );

  const selectProduct = (product: DemoProduct) => {
    setSelected(product);
    setMediaType(null);
    setStatus("idle");
    setPhotoUrl(null);
    setError(null);
    setLastScript("");
  };

  const handleGenerate = async (type: MediaType) => {
    if (!selected) return;
    setMediaType(type);
    setError(null);
    setStatus("generating");

    if (type === "video") {
      // Geração de vídeo por IA ainda não está disponível — ver disclosure abaixo.
      window.setTimeout(() => setStatus("done"), 1200);
      return;
    }

    setPhotoUrl(null);
    try {
      const result = await generatePhoto({
        data: { title: selected.title, category: selected.category },
      });
      setPhotoUrl(result.dataUrl);
      setStatus("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível gerar a foto agora. Tente de novo.",
      );
      setStatus("idle");
      setMediaType(null);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(lastScript);
      toast.success("Depoimento copiado");
    } catch {
      toast.info('Copie manualmente pelo botão "Criar script do produto" acima');
    }
  };

  const handleCopyPhotoAndScript = async () => {
    if (!photoUrl) {
      await handleCopyScript();
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": dataUrlToPngBlob(photoUrl),
          "text/plain": new Blob([lastScript], { type: "text/plain" }),
        }),
      ]);
      toast.success("Foto e legenda copiadas — é só colar direto no grupo");
    } catch {
      // Navegador sem suporte a copiar imagem + texto juntos (ex: Firefox).
      try {
        await navigator.clipboard.writeText(lastScript);
        toast.info(
          "Esse navegador não deixa copiar foto e legenda juntas — copiei só a legenda. Baixe a foto ao lado.",
        );
      } catch {
        toast.info('Copie manualmente pelo botão "Criar script do produto" acima');
      }
    }
  };

  const savedLink = selected ? links[selected.id]?.url : undefined;
  const showGroupsStep = Boolean(photoUrl && lastScript && groupsInfo);

  return (
    <div className="space-y-7">
      {/* Passo 1: escolher produto */}
      <Reveal className="surface-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
            1
          </span>
          <p className="text-[14px] font-medium text-foreground">Escolha o produto</p>
        </div>
        <ProductPicker selected={selected} onSelect={selectProduct} />
      </Reveal>

      {/* Passo 2: escolher tipo de mídia */}
      {selected && (
        <Reveal className="surface-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              2
            </span>
            <p className="text-[14px] font-medium text-foreground">
              O que você quer criar pro "{selected.title}"?
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              variant={mediaType === "foto" ? "default" : "outline"}
              className="gap-2"
              onClick={() => handleGenerate("foto")}
              disabled={status === "generating"}
            >
              <Camera className="size-4" />
              Gerar foto
            </Button>
            <Button
              variant={mediaType === "video" ? "default" : "outline"}
              className="gap-2"
              onClick={() => handleGenerate("video")}
              disabled={status === "generating"}
            >
              <Video className="size-4" />
              Gerar vídeo
            </Button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {status === "generating" && (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-hover/60 px-4 py-3.5 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand" />
              Gerando {mediaType === "video" ? "vídeo" : "foto"}
              {mediaType === "foto" ? " com IA (Nano Banana)..." : "..."}
            </div>
          )}

          {status === "done" && mediaType && (
            <div className="mt-4 space-y-3">
              {mediaType === "foto" ? (
                <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
                  <img
                    src={photoUrl ?? selected.image}
                    alt={selected.title}
                    className="size-16 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">
                      Foto pronta pra postar
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Gerada por IA (Gemini Nano Banana) a partir do produto selecionado.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-surface-hover/60 p-3.5">
                  <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      Geração de vídeo por IA ainda não está disponível
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Essa parte precisa de um provedor de vídeo configurado (com custo por geração)
                      — é o próximo passo técnico. Enquanto isso, use a aba "Cenas para Vídeo" pra
                      gerar uma imagem de referência, ou a foto do produto abaixo.
                    </p>
                    <img
                      src={selected.image}
                      alt={selected.title}
                      className="mt-2.5 size-16 rounded-lg border border-border object-cover"
                    />
                  </div>
                </div>
              )}

              <Button className="gap-2" onClick={() => setScriptOpen(true)}>
                <Wand2 className="size-4" />
                Criar script do produto
              </Button>
            </div>
          )}
        </Reveal>
      )}

      {/* Passo 3: anunciar nos grupos */}
      {showGroupsStep && selected && groupsInfo && (
        <Reveal className="surface-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              3
            </span>
            <p className="text-[14px] font-medium text-foreground">Anuncie nos grupos</p>
          </div>
          <p className="mb-4 ml-8 text-[12.5px] text-muted-foreground">
            Grupos de {groupsInfo.nicheLabel} prontos pra você postar — foto e script já gerados
            acima, é só copiar e colar ao entrar em cada um.
          </p>

          <div className="mb-4 flex flex-wrap gap-2.5">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={handleCopyPhotoAndScript}
            >
              <Copy className="size-3.5" />
              {photoUrl ? "Copiar foto + legenda" : "Copiar script"}
            </Button>
            {photoUrl && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyScript}>
                  <Copy className="size-3.5" />
                  Só o texto
                </Button>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href={photoUrl} download={`${selected.id}-foto.jpg`}>
                    <Download className="size-3.5" />
                    Baixar foto
                  </a>
                </Button>
              </>
            )}
          </div>
          {photoUrl && (
            <p className="mb-4 -mt-2 text-[11.5px] text-muted-foreground">
              "Copiar foto + legenda" cola os dois juntos direto na caixa de post do grupo (no
              Chrome). Se o grupo só aceitar um por vez, use os botões separados ao lado.
            </p>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {groupsInfo.groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Facebook className="size-3.5 shrink-0 text-muted-foreground" />
                  <p className="truncate text-[12.5px] font-medium text-foreground">{group.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 text-[12px]"
                  onClick={() => window.open(group.url, "_blank", "noopener,noreferrer")}
                >
                  Entrar
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            ))}
          </div>

          <Button asChild variant="ghost" size="sm" className="mt-3 gap-1 text-[12.5px]">
            <Link
              to="/grupos-divulgacao"
              search={groupsInfo.nicheId ? { niche: groupsInfo.nicheId } : {}}
            >
              Ver todos os grupos desse nicho
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </Reveal>
      )}

      {!selected && (
        <Stagger>
          <StaggerItem>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3.5 text-[12.5px] text-muted-foreground">
              <Sparkles className="size-4 text-brand" />
              Selecione um produto acima pra começar a gerar conteúdo.
            </div>
          </StaggerItem>
        </Stagger>
      )}

      <TestimonialScriptModal
        product={selected}
        link={savedLink}
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        onScriptChange={setLastScript}
      />
    </div>
  );
}

function IaPage() {
  const t = useT();
  const [tab, setTab] = useState("foto-script");

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("IA")}
        description={t(
          "Escolha um produto, gere a mídia de divulgação e o script de depoimento pra postar.",
        )}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger
            value="foto-script"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] data-[state=active]:border-transparent data-[state=active]:bg-surface-hover data-[state=active]:shadow-none"
          >
            Foto e script
          </TabsTrigger>
          <TabsTrigger
            value="cenas-video"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] data-[state=active]:border-transparent data-[state=active]:bg-surface-hover data-[state=active]:shadow-none"
          >
            Cenas para vídeo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="foto-script" className="mt-5">
          <FotoScriptTab />
        </TabsContent>

        <TabsContent value="cenas-video" className="mt-5">
          <VideoScenesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
