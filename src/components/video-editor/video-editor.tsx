import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Captions,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Upload,
  Video as VideoIcon,
} from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OverlayPosition = "top" | "center" | "bottom";

type Overlay = {
  id: string;
  text: string;
  position: OverlayPosition;
  start: number;
  end: number;
};

const POSITION_LABELS: Record<OverlayPosition, string> = {
  top: "Topo",
  center: "Centro",
  bottom: "Base",
};

const EXPORT_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return EXPORT_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function extensionFor(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, overlay: Overlay) {
  const text = overlay.text.trim();
  if (!text) return;

  const fontSize = Math.round(canvas.width * 0.05);
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxWidth = canvas.width * 0.86;
  const lines = wrapCanvasText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lines.length * lineHeight;

  let centerY: number;
  if (overlay.position === "top") {
    centerY = canvas.height * 0.14 + blockHeight / 2;
  } else if (overlay.position === "bottom") {
    centerY = canvas.height * 0.86 - blockHeight / 2;
  } else {
    centerY = canvas.height / 2;
  }

  const startY = centerY - blockHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.lineWidth = fontSize * 0.16;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineJoin = "round";
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, canvas.width / 2, y);
  });
}

function OverlayPreviewText({ text }: { text: string }) {
  return (
    <div
      className="max-w-[92%] whitespace-pre-wrap break-words text-center text-[13px] font-bold leading-snug text-white"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)" }}
    >
      {text}
    </div>
  );
}

type ExportState = "idle" | "preparing" | "recording" | "done" | "error";

export function VideoEditor() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedMime, setExportedMime] = useState("");
  const [supportsExport, setSupportsExport] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSupportsExport(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        typeof HTMLVideoElement !== "undefined" &&
        "captureStream" in HTMLVideoElement.prototype &&
        pickMimeType() !== "",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    };
  }, [exportedUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setFileName(file.name);
    setOverlays([]);
    setExportedUrl(null);
    setExportState("idle");
    setExportError(null);
    setIsPlaying(false);
    e.target.value = "";
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(d);
    setTrimRange([0, d]);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime >= trimRange[1]) {
      video.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    if (video.currentTime < trimRange[0] || video.currentTime >= trimRange[1]) {
      video.currentTime = trimRange[0];
    }
    void video.play();
    setIsPlaying(true);
  };

  const handleTrimChange = (value: number[]) => {
    const [start, end] = value;
    setTrimRange([start, end]);
    const video = videoRef.current;
    if (video && (video.currentTime < start || video.currentTime > end)) {
      video.currentTime = start;
    }
  };

  const addOverlay = () => {
    const [start, end] = trimRange;
    const proposedEnd = Math.min(start + 3, end);
    const overlay: Overlay = {
      id: crypto.randomUUID(),
      text: "",
      position: "bottom",
      start,
      end: proposedEnd > start ? proposedEnd : end,
    };
    setOverlays((prev) => [...prev, overlay]);
  };

  const updateOverlay = (id: string, patch: Partial<Overlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const activeOverlays = useMemo(
    () => overlays.filter((o) => currentTime >= o.start && currentTime <= o.end),
    [overlays, currentTime],
  );

  const handleExport = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setExportState("preparing");
    setExportError(null);
    setExportedUrl(null);

    try {
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado nesse navegador.");

      const captureVideo = video as HTMLVideoElement & { captureStream?: () => MediaStream };
      const captureCanvas = canvas as HTMLCanvasElement & {
        captureStream?: (fps?: number) => MediaStream;
      };
      const sourceStream = captureVideo.captureStream?.();
      const canvasStream = captureCanvas.captureStream?.(30);
      if (!sourceStream || !canvasStream) {
        throw new Error(
          "Exportar não é suportado nesse navegador. Tente pelo Chrome no computador.",
        );
      }

      const mimeType = pickMimeType();
      if (!mimeType) {
        throw new Error("Formato de exportação não suportado nesse navegador.");
      }

      const audioTracks = sourceStream.getAudioTracks();
      const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      video.pause();
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = trimRange[0];
      });

      setExportState("recording");
      recorder.start();
      await video.play();
      setIsPlaying(true);

      let raf = 0;
      const draw = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const t = video.currentTime;
        for (const overlay of overlays) {
          if (t >= overlay.start && t <= overlay.end) {
            drawOverlay(ctx, canvas, overlay);
          }
        }
        if (video.currentTime < trimRange[1] && !video.paused && !video.ended) {
          raf = requestAnimationFrame(draw);
        }
      };
      raf = requestAnimationFrame(draw);

      await new Promise<void>((resolve) => {
        const onTimeUpdate = () => {
          if (video.currentTime >= trimRange[1] || video.ended) {
            video.pause();
            video.removeEventListener("timeupdate", onTimeUpdate);
            cancelAnimationFrame(raf);
            resolve();
          }
        };
        video.addEventListener("timeupdate", onTimeUpdate);
      });

      recorder.stop();
      const blob = await stopped;
      const url = URL.createObjectURL(blob);
      setExportedUrl(url);
      setExportedMime(mimeType);
      setExportState("done");
      setIsPlaying(false);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Não foi possível exportar o vídeo agora.",
      );
      setExportState("error");
    }
  }, [overlays, trimRange]);

  return (
    <div className="space-y-7">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Passo 1: enviar vídeo */}
      <Reveal className="surface-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
            1
          </span>
          <p className="text-[14px] font-medium text-foreground">Envie o vídeo</p>
        </div>
        <p className="mb-3 ml-8 text-[12.5px] text-muted-foreground">
          Grave o vídeo com o celular (use a cena gerada na aba IA como referência, se quiser) e
          envie o arquivo aqui pra cortar e legendar.
        </p>
        <div className="ml-8 flex flex-wrap items-center gap-2.5">
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            {videoUrl ? "Trocar vídeo" : "Escolher vídeo"}
          </Button>
          {fileName && (
            <span className="truncate text-[12.5px] text-muted-foreground">{fileName}</span>
          )}
        </div>
      </Reveal>

      {/* Passo 2: cortar e legendar */}
      {videoUrl && (
        <Reveal className="surface-card p-5">
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                  2
                </span>
                <p className="text-[14px] font-medium text-foreground">Corte e confira</p>
              </div>

              <div
                className="relative overflow-hidden rounded-xl border border-border bg-black"
                style={{ aspectRatio: "9 / 16" }}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="size-full object-contain"
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPause={() => setIsPlaying(false)}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col p-3">
                  <div className="flex flex-1 items-start justify-center">
                    {activeOverlays
                      .filter((o) => o.position === "top")
                      .map((o) => (
                        <OverlayPreviewText key={o.id} text={o.text} />
                      ))}
                  </div>
                  <div className="flex flex-1 items-center justify-center">
                    {activeOverlays
                      .filter((o) => o.position === "center")
                      .map((o) => (
                        <OverlayPreviewText key={o.id} text={o.text} />
                      ))}
                  </div>
                  <div className="flex flex-1 items-end justify-center">
                    {activeOverlays
                      .filter((o) => o.position === "bottom")
                      .map((o) => (
                        <OverlayPreviewText key={o.id} text={o.text} />
                      ))}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-2.5 w-full gap-2"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {isPlaying ? "Pausar" : "Ver corte"}
              </Button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Scissors className="size-3.5" />
                  Início/fim do corte
                </span>
                <span>
                  {formatTime(trimRange[0])} – {formatTime(trimRange[1])} de {formatTime(duration)}
                </span>
              </div>
              <Slider
                min={0}
                max={duration || 1}
                step={0.1}
                value={trimRange}
                onValueChange={handleTrimChange}
                className="mb-6"
              />

              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Captions className="size-3.5" />
                  Legendas e textos
                </p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addOverlay}>
                  <Plus className="size-3.5" />
                  Adicionar
                </Button>
              </div>

              {overlays.length === 0 && (
                <p className="rounded-lg border border-dashed border-border bg-surface-hover/60 px-3 py-3 text-[12.5px] text-muted-foreground">
                  Nenhuma legenda ainda. Adicione trechos de texto com o tempo em que aparecem no
                  vídeo.
                </p>
              )}

              <div className="space-y-3">
                {overlays.map((overlay, index) => (
                  <div key={overlay.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-medium text-muted-foreground">
                        Legenda {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeOverlay(overlay.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <Textarea
                      value={overlay.text}
                      onChange={(e) => updateOverlay(overlay.id, { text: e.target.value })}
                      placeholder="Ex: Achei esse achadinho e amei!"
                      className="mb-2.5 min-h-[52px] text-[13px]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={overlay.position}
                        onValueChange={(v) =>
                          updateOverlay(overlay.id, { position: v as OverlayPosition })
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px] bg-background text-[12.5px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(POSITION_LABELS) as OverlayPosition[]).map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {POSITION_LABELS[pos]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <span>de</span>
                        <Input
                          type="number"
                          min={trimRange[0]}
                          max={overlay.end}
                          step={0.5}
                          value={overlay.start.toFixed(1)}
                          onChange={(e) =>
                            updateOverlay(overlay.id, { start: Number(e.target.value) })
                          }
                          className="h-8 w-[68px] text-[12.5px]"
                        />
                        <span>até</span>
                        <Input
                          type="number"
                          min={overlay.start}
                          max={trimRange[1]}
                          step={0.5}
                          value={overlay.end.toFixed(1)}
                          onChange={(e) =>
                            updateOverlay(overlay.id, { end: Number(e.target.value) })
                          }
                          className="h-8 w-[68px] text-[12.5px]"
                        />
                        <span>s</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Passo 3: exportar */}
      {videoUrl && (
        <Reveal className="surface-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
              3
            </span>
            <p className="text-[14px] font-medium text-foreground">Exporte e poste</p>
          </div>

          {!supportsExport && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Esse navegador não suporta exportar vídeo por aqui. Tente pelo Chrome no computador.
              </p>
            </div>
          )}

          <Button
            className="gap-2"
            disabled={!supportsExport || exportState === "preparing" || exportState === "recording"}
            onClick={handleExport}
          >
            {exportState === "preparing" || exportState === "recording" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <VideoIcon className="size-4" />
            )}
            {exportState === "recording"
              ? "Exportando..."
              : exportState === "preparing"
                ? "Preparando..."
                : "Exportar vídeo cortado e legendado"}
          </Button>
          <p className="mt-2 text-[12px] text-muted-foreground">
            A exportação roda aqui no navegador (sem subir seu vídeo pra nenhum servidor) — pode
            levar o mesmo tempo da duração do corte.
          </p>

          {exportError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{exportError}</p>
            </div>
          )}

          {exportState === "done" && exportedUrl && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
              <video
                src={exportedUrl}
                className="h-16 w-9 shrink-0 rounded-lg border border-border object-cover"
                muted
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">Vídeo pronto</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Baixe e poste direto no TikTok, Reels ou Shorts.
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                <a
                  href={exportedUrl}
                  download={`${fileName.replace(/\.[^.]+$/, "") || "video"}-editado.${extensionFor(exportedMime)}`}
                >
                  <Download className="size-3.5" />
                  Baixar
                </a>
              </Button>
            </div>
          )}
        </Reveal>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
