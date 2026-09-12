import { useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { formatClockTime } from "@/lib/membros";

type VideoPlayerProps = {
  videoUrl: string | null;
  initialSeconds?: number;
  // Chamado periodicamente (a cada ~4s), ao pausar, e uma vez ao desmontar
  // (troca de aula) — sempre com o tempo mais recente conhecido.
  onProgress: (seconds: number, duration: number) => void;
  onEnded: () => void;
};

export function VideoPlayer({
  videoUrl,
  initialSeconds = 0,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialSeconds);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  // Refs pra sempre ter a versão mais recente sem precisar recriar os
  // listeners (evita closures presas no primeiro render).
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const currentTimeRef = useRef(initialSeconds);
  const lastReportRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoUrl) return;

    function handleLoadedMetadata() {
      if (!v) return;
      setDuration(v.duration || 0);
      if (initialSeconds > 1 && initialSeconds < (v.duration || Infinity) - 2) {
        v.currentTime = initialSeconds;
      }
    }
    function handleTimeUpdate() {
      if (!v) return;
      setCurrent(v.currentTime);
      currentTimeRef.current = v.currentTime;
      const now = Date.now();
      if (now - lastReportRef.current > 4000) {
        lastReportRef.current = now;
        onProgressRef.current(v.currentTime, v.duration || 0);
      }
    }
    function handlePlay() {
      setPlaying(true);
    }
    function handlePause() {
      setPlaying(false);
      if (v) onProgressRef.current(v.currentTime, v.duration || 0);
    }
    function handleEnded() {
      setPlaying(false);
      onEndedRef.current();
    }

    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);
    v.addEventListener("ended", handleEnded);

    return () => {
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
      v.removeEventListener("ended", handleEnded);
      // Troca de aula / saída da página — salva a última posição conhecida.
      if (currentTimeRef.current > 0) {
        onProgressRef.current(currentTimeRef.current, v.duration || 0);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function seek(seconds: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    setCurrent(seconds);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  if (!videoUrl) {
    return (
      <div className="mb-player flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div className="grid size-14 place-items-center rounded-full border border-[var(--mb-border)] bg-white/[0.03]">
            <Play className="size-5 text-[var(--mb-text-faint)]" />
          </div>
          <p className="mb-heading text-[15px] text-[var(--mb-text-muted)]">Aula em produção</p>
          <p className="max-w-xs text-[13px] text-[var(--mb-text-faint)]">
            Essa aula ainda não foi gravada. Assim que estiver pronta, ela aparece aqui
            automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mb-player group/player">
      <video
        ref={videoRef}
        src={videoUrl}
        className="cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-100 transition-opacity duration-200"
          aria-label="Reproduzir"
        >
          <span className="grid size-16 place-items-center rounded-full bg-[var(--mb-orange)] text-[#100600] shadow-[0_8px_24px_-8px_rgba(255,106,0,0.5)]">
            <Play className="ml-1 size-6" fill="currentColor" />
          </span>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-3 pt-10 opacity-0 transition-opacity duration-200 group-hover/player:opacity-100 [.group\\/player:has(video:not(:hover))_&]:opacity-0">
        <input
          type="range"
          className="mb-player-scrubber"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Progresso do vídeo"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="text-white/90 transition-colors hover:text-white"
          >
            {playing ? (
              <Pause className="size-4" fill="currentColor" />
            ) : (
              <Play className="size-4" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="text-white/70 transition-colors hover:text-white"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <span className="text-[12px] tabular-nums text-white/70">
            {formatClockTime(current)} / {formatClockTime(duration)}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-auto text-white/70 transition-colors hover:text-white"
            aria-label="Tela cheia"
          >
            <Maximize className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
