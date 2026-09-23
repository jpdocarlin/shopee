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

// Aulas gravadas e hospedadas no YouTube (em vez de um mp4 direto) não tocam
// num <video src="...">  — o navegador não sabe reproduzir uma URL de
// watch/youtu.be. Detecta os dois formatos de link e decide qual player usar
// mais abaixo, sem exigir nenhuma mudança em quem chama <VideoPlayer />.
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function VideoPlayer({
  videoUrl,
  initialSeconds = 0,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
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

  const youtubeId = getYouTubeVideoId(videoUrl);
  if (youtubeId) {
    return (
      <YouTubeVideoPlayer
        videoId={youtubeId}
        initialSeconds={initialSeconds}
        onProgress={onProgress}
        onEnded={onEnded}
      />
    );
  }

  return (
    <NativeVideoPlayer
      videoUrl={videoUrl}
      initialSeconds={initialSeconds}
      onProgress={onProgress}
      onEnded={onEnded}
    />
  );
}

type InnerPlayerProps = {
  initialSeconds: number;
  onProgress: (seconds: number, duration: number) => void;
  onEnded: () => void;
};

function NativeVideoPlayer({
  videoUrl,
  initialSeconds,
  onProgress,
  onEnded,
}: InnerPlayerProps & { videoUrl: string }) {
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

      {/* Barra de controles sempre visível — antes só aparecia no :hover, o
          que deixava o player sem nenhum jeito de pausar/buscar/ampliar em
          touch (celular/tablet não tem hover) e exigia mirar o mouse bem em
          cima do vídeo no desktop. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-3 pt-10">
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

// ---------- player pra aulas hospedadas no YouTube ----------
// Carrega a IFrame API oficial do YouTube uma única vez (compartilhada entre
// todas as instâncias do player ao navegar entre aulas) e expõe os mesmos
// controles/progresso da versão nativa (scrubber, play/pause, mute, tela
// cheia, e o callback onProgress que alimenta a barra de conclusão da aula).

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayerInstance = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
};

let youTubeApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;
  youTubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return youTubeApiPromise;
}

function YouTubeVideoPlayer({
  videoId,
  initialSeconds,
  onProgress,
  onEnded,
}: InnerPlayerProps & { videoId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialSeconds);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const currentTimeRef = useRef(initialSeconds);
  const lastReportRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pollId: number | undefined;

    void loadYouTubeIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      const YT = window.YT;
      const player = new YT.Player(mountRef.current, {
        videoId,
        height: "100%",
        width: "100%",
        // 23/09/2026: descoberto ao vivo (Jp reportou aula travando no meio
        // e "reiniciando toda hora" durante a reprodução) — a posição
        // retomada só era aplicada via `seekTo()` DEPOIS do player ficar
        // pronto, nunca no embed em si. Em conexão instável ou celular (o
        // navegador pode descartar/recarregar o iframe do YouTube por
        // pressão de memória — comum em mobile ao trocar de app ou apagar a
        // tela com um vídeo longo tocando), o iframe volta do zero porque o
        // embed original nunca sabia que devia começar em outro ponto.
        // Passar `start` direto no embed cobre esse caso: mesmo que o
        // iframe seja recriado por fora do nosso controle, ele nasce já
        // perto de onde a pessoa parou.
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(initialSeconds > 1 ? { start: Math.floor(initialSeconds) } : {}),
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            const total = player.getDuration() || 0;
            setDuration(total);
            if (initialSeconds > 1 && initialSeconds < (total || Infinity) - 2) {
              player.seekTo(initialSeconds, true);
            }
            // Só começa a sondar getCurrentTime/getDuration depois que o
            // player sinaliza que está pronto — chamar esses métodos antes
            // do onReady (ex.: logo após `new YT.Player(...)`, enquanto o
            // iframe interno ainda está carregando) lança
            // "getCurrentTime is not a function", porque o objeto do player
            // só ganha os métodos reais quando a comunicação com o iframe é
            // estabelecida.
            if (pollId) window.clearInterval(pollId);
            pollId = window.setInterval(() => {
              const active = playerRef.current;
              if (!active) return;
              // 23/09/2026: se o canal postMessage com o iframe quebrar (ex.:
              // iframe recarregado/descartado pelo navegador por fora do
              // nosso controle), getCurrentTime/getDuration podem lançar em
              // vez de só devolver 0 — sem o try/catch isso derrubava o
              // intervalo inteiro (erro não tratado dentro de setInterval
              // simplesmente para de rodar silenciosamente), então nem o
              // progresso nem a UI eram atualizados de novo até trocar de
              // aula. Com o catch, ignora esse ciclo e tenta de novo no
              // próximo tick.
              try {
                const time = active.getCurrentTime();
                const totalNow = active.getDuration() || 0;
                setCurrent(time);
                currentTimeRef.current = time;
                if (totalNow) setDuration(totalNow);
                const now = Date.now();
                if (now - lastReportRef.current > 4000) {
                  lastReportRef.current = now;
                  onProgressRef.current(time, totalNow);
                }
              } catch {
                // Ignora este ciclo — próximo tick tenta de novo.
              }
            }, 500);
          },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            if (event.data === YT.PlayerState.PLAYING) {
              setPlaying(true);
            } else if (event.data === YT.PlayerState.PAUSED) {
              setPlaying(false);
              onProgressRef.current(player.getCurrentTime() || 0, player.getDuration() || 0);
            } else if (event.data === YT.PlayerState.ENDED) {
              setPlaying(false);
              onEndedRef.current();
            }
          },
          // 23/09/2026: antes não existia — um erro real do player (rede,
          // restrição de embed, etc.) deixava a tela "congelada" (nosso
          // estado `playing` continuava true porque só mudamos ele em
          // PLAYING/PAUSED/ENDED) sem nenhum sinal do que aconteceu. Loga
          // pra investigar casos futuros; não tenta adivinhar uma recuperação
          // automática pra não mascarar erro real de rede.
          onError: (event: { data: number }) => {
            if (cancelled) return;
            console.warn("[VideoPlayer] erro do YouTube IFrame API:", event.data);
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (currentTimeRef.current > 0) {
        onProgressRef.current(currentTimeRef.current, playerRef.current?.getDuration() || 0);
      }
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player || !window.YT) return;
    if (player.getPlayerState() === window.YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }

  function seek(seconds: number) {
    playerRef.current?.seekTo(seconds, true);
    setCurrent(seconds);
    currentTimeRef.current = seconds;
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  return (
    <div ref={containerRef} className="mb-player group/player">
      <div ref={mountRef} className="absolute inset-0" onClick={togglePlay} />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
        </div>
      )}

      {ready && !playing && (
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

      {/* Barra de controles sempre visível — mesmo motivo do player nativo
          acima: hover-only deixava sem jeito de pausar/buscar/ampliar em
          touch, e escondia os controles assim que o mouse saía de cima do
          vídeo mesmo pausado. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-3 pt-10">
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
