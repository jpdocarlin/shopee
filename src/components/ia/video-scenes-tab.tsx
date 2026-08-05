import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Download, Loader2, Sparkles, Wand2 } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductPicker } from "@/components/ia/product-picker";
import {
  CUSTOM_SCENARIO_ID,
  VIDEO_GENDERS,
  VIDEO_SCENARIOS,
  VIDEO_SHOT_TYPES,
} from "@/data/video-scenes";
import { generateVideoScenePhoto } from "@/lib/gemini-image.functions";
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

  const generateScene = useServerFn(generateVideoScenePhoto);

  const selectProduct = (product: DemoProduct) => {
    setSelected(product);
    setScenarioId(null);
    setCustomScenario("");
    setGenderId(null);
    setShotTypeId(null);
    setStatus("idle");
    setImageUrl(null);
    setError(null);
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
                <Button variant="outline" size="sm" className="mt-2.5 gap-1.5" asChild>
                  <a href={imageUrl} download={`${selected.id}-cena.jpg`}>
                    <Download className="size-3.5" />
                    Baixar imagem
                  </a>
                </Button>
              </div>
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
