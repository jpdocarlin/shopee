import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Clapperboard,
  Copy,
  Download,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductPicker } from "@/components/ia/product-picker";
import {
  CUSTOM_SCENARIO_ID,
  VIDEO_GENDERS,
  VIDEO_SCENARIOS,
  VIDEO_SHOT_TYPES,
} from "@/data/video-scenes";
import { generateVideoScenePhoto } from "@/lib/gemini-image.functions";
import { generateVideoScript } from "@/lib/gemini-text.functions";
import { buildFallbackVideoScript } from "@/lib/video-script";
import { buildFlowPrompt } from "@/lib/flow-prompt";
import type { DemoProduct } from "@/data/demo-products";
import { cn } from "@/lib/utils";

type Status = "idle" | "generating" | "done";

export function VideoScenesTab() {
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [customScenario, setCustomScenario] = useState("");
  const [genderId, setGenderId] = useState<string | null>(null);
  const [shotTypeId, setShotTypeId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Fala do vídeo — só aparece depois que a pessoa clica em "Gerar script".
  const [script, setScript] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [flowCopied, setFlowCopied] = useState(false);
  const scriptVariantRef = useRef(0);

  const generateScene = useServerFn(generateVideoScenePhoto);
  const generateScript = useServerFn(generateVideoScript);

  const resetScript = () => {
    setScript(null);
    setScriptCopied(false);
    setFlowCopied(false);
    scriptVariantRef.current = 0;
  };

  const selectProduct = (product: DemoProduct) => {
    setSelected(product);
    setScenarioId(null);
    setCustomScenario("");
    setGenderId(null);
    setShotTypeId(null);
    setStatus("idle");
    setImageUrl(null);
    setError(null);
    resetScript();
  };

  const isCustomScenario = scenarioId === CUSTOM_SCENARIO_ID;
  const scenarioReady =
    Boolean(scenarioId) && (!isCustomScenario || customScenario.trim().length > 0);
  const canGenerate = Boolean(selected && scenarioReady && genderId && shotTypeId);

  const handleGenerate = async () => {
    if (!selected || !scenarioId || !genderId || !shotTypeId) return;
    setStatus("generating");
    setError(null);
    setImageUrl(null);
    resetScript();
    try {
      const result = await generateScene({
        data: {
          title: selected.title,
          category: selected.category,
          productImageUrl: selected.image,
          scenarioId,
          customScenario: isCustomScenario ? customScenario.trim() : undefined,
          genderId,
          shotTypeId,
        },
      });
      setImageUrl(result.dataUrl);
      setStatus("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível gerar a cena agora. Tente de novo.",
      );
      setStatus("idle");
    }
  };

  const scenarioLabel = isCustomScenario
    ? customScenario.trim()
    : VIDEO_SCENARIOS.find((s) => s.id === scenarioId)?.label;

  const handleGenerateScript = async () => {
    if (!selected) return;
    setScriptLoading(true);
    setScriptCopied(false);
    try {
      const result = await generateScript({
        data: {
          title: selected.title,
          category: selected.category,
          scenario: scenarioLabel || undefined,
          variant: scriptVariantRef.current,
        },
      });
      setScript(result.script);
      scriptVariantRef.current += 1;
    } catch (err) {
      // Fallback local: melhor um script pronto no formato certo do que nada.
      console.error("[VideoScenesTab] falha ao gerar script:", err);
      setScript(buildFallbackVideoScript(selected));
    } finally {
      setScriptLoading(false);
    }
  };

  const handleCopyScript = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setScriptCopied(true);
      toast.success("Script copiado");
    } catch {
      toast.info("Copie manualmente o texto acima");
    }
  };

  // Prompt pro Flow (Veo): repete tudo que já foi escolhido aqui pra ele não
  // trocar produto, cenário nem enquadramento na hora de animar.
  const flowPrompt =
    selected && script && scenarioId && genderId && shotTypeId
      ? buildFlowPrompt({
          productTitle: selected.title,
          scenarioId,
          customScenario: isCustomScenario ? customScenario.trim() : undefined,
          genderId,
          shotTypeId,
          script,
        })
      : null;

  const handleCopyFlowPrompt = async () => {
    if (!flowPrompt) return;
    try {
      await navigator.clipboard.writeText(flowPrompt);
      setFlowCopied(true);
      toast.success("Prompt copiado", { description: "Cole no Flow junto com a imagem da cena" });
    } catch {
      toast.info("Copie manualmente o texto acima");
    }
  };

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

      {/* Passo 2: cenário + gênero + tipo de vídeo */}
      {selected && (
        <Reveal className="surface-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              2
            </span>
            <p className="text-[14px] font-medium text-foreground">Escolha o cenário</p>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {VIDEO_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setScenarioId(scenario.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                  scenarioId === scenario.id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-muted-foreground hover:border-white/20",
                )}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          {isCustomScenario && (
            <Input
              value={customScenario}
              onChange={(e) => setCustomScenario(e.target.value)}
              placeholder="Descreva o cenário, ex: numa academia, com equipamentos ao fundo"
              className="mb-5 h-9 text-[13px]"
            />
          )}
          {!isCustomScenario && <div className="mb-5" />}

          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              3
            </span>
            <p className="text-[14px] font-medium text-foreground">Quem aparece na cena</p>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {VIDEO_GENDERS.map((gender) => (
              <button
                key={gender.id}
                type="button"
                onClick={() => setGenderId(gender.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                  genderId === gender.id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-muted-foreground hover:border-white/20",
                )}
              >
                {gender.label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              4
            </span>
            <p className="text-[14px] font-medium text-foreground">Escolha o tipo de vídeo</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {VIDEO_SHOT_TYPES.map((shot) => {
              const isSelected = shotTypeId === shot.id;
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => setShotTypeId(shot.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-brand bg-brand/5"
                      : "border-border bg-card hover:border-white/15",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground">{shot.label}</p>
                    {isSelected && <Check className="size-3.5 shrink-0 text-brand" />}
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                    {shot.description}
                  </p>
                </button>
              );
            })}
          </div>

          <Button
            className="mt-5 gap-2"
            disabled={!canGenerate || status === "generating"}
            onClick={handleGenerate}
          >
            <Wand2 className="size-4" />
            Gerar imagem da cena
          </Button>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {status === "generating" && (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-hover/60 px-4 py-3.5 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand" />
              Gerando cena com IA (Nano Banana)...
            </div>
          )}

          {status === "done" && imageUrl && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
              <img
                src={imageUrl}
                alt="Cena gerada pra referência de vídeo"
                className="w-24 shrink-0 rounded-lg border border-border object-cover"
                style={{ aspectRatio: "9 / 16" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">Cena pronta</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Use como referência de still pra gravar seu vídeo (ou pra guiar a edição). Geração
                  de vídeo completo por IA ainda não está disponível.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleGenerateScript}
                    disabled={scriptLoading}
                  >
                    {scriptLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <MessageSquareQuote className="size-3.5" />
                    )}
                    {scriptLoading
                      ? "Escrevendo…"
                      : script
                        ? "Gerar outro script"
                        : "Gerar script do vídeo"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href={imageUrl} download={`${selected.id}-cena.jpg`}>
                      <Download className="size-3.5" />
                      Baixar imagem
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {status === "done" && script && (
            <div className="mt-3 rounded-lg border border-border bg-card p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <MessageSquareQuote className="size-3.5 text-brand" />
                  Fala do vídeo
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-[11.5px]"
                  onClick={handleGenerateScript}
                  disabled={scriptLoading}
                >
                  <RefreshCw className={cn("size-3", scriptLoading && "animate-spin")} />
                  Outra versão
                </Button>
              </div>
              <Textarea
                readOnly
                value={script}
                rows={3}
                className="text-[12.5px] leading-relaxed"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-muted-foreground">
                  É o que você fala olhando pra câmera, segurando o produto — uns 12 segundos.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 text-[11.5px]"
                  onClick={handleCopyScript}
                >
                  {scriptCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Copiar
                </Button>
              </div>
            </div>
          )}

          {status === "done" && flowPrompt && (
            <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Clapperboard className="size-3.5 text-brand" />
                  Prompt pro Flow (vídeo)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 text-[11.5px]"
                  onClick={handleCopyFlowPrompt}
                >
                  {flowCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Copiar prompt
                </Button>
              </div>
              <Textarea
                readOnly
                value={flowPrompt}
                rows={10}
                className="text-[11.5px] leading-relaxed"
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Cole no Flow <span className="text-foreground">junto com a imagem da cena</span> (o
                botão "Baixar imagem" acima). O prompt já trava o produto, o cenário e o
                enquadramento que você escolheu, e manda a fala com a voz certa.
              </p>
            </div>
          )}
        </Reveal>
      )}

      {!selected && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3.5 text-[12.5px] text-muted-foreground">
          <Sparkles className="size-4 text-brand" />
          Selecione um produto acima pra começar a gerar a cena.
        </div>
      )}
    </div>
  );
}
