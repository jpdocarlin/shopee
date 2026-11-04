// Animação de "publicando o produto": abre por cima da tela de Criar anúncio
// enquanto a Shopee / o Mercado Livre recebem o anúncio.
//
// A publicação é uma chamada só no servidor (não tem progresso real vindo da
// API), então os passos avançam num ritmo fixo e o ÚLTIMO passo fica girando
// até a resposta chegar — o "Publicado!" só aparece quando a loja confirmou.
// Se der erro, mostra o motivo e não comemora nada.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { explainPublishError } from "@/lib/publish-error-explain";
import { cn } from "@/lib/utils";

export type PublishMarketplace = "shopee" | "mercado-livre";
export type PublishPhase = "running" | "success" | "error";

export type PublishProgressState = {
  marketplace: PublishMarketplace;
  phase: PublishPhase;
  product: { title: string; image: string | null; priceCents: number };
  error?: string | null;
  viewUrl?: string | null;
};

const LABEL: Record<PublishMarketplace, string> = {
  shopee: "Shopee",
  "mercado-livre": "Mercado Livre",
};

// "na Shopee" / "no Mercado Livre"
const NA: Record<PublishMarketplace, string> = {
  shopee: "na Shopee",
  "mercado-livre": "no Mercado Livre",
};

const LOGO: Record<PublishMarketplace, string> = {
  shopee: "/logo-shopee.png",
  "mercado-livre": "/logo-mercadolivre.png",
};

function stepsFor(m: PublishMarketplace) {
  return m === "shopee"
    ? [
        "Enviando a foto do produto",
        "Criando o anúncio na Shopee",
        "Definindo preço, estoque e frete",
        "Conferindo o anúncio na loja",
      ]
    : [
        "Enviando a foto do produto",
        "Criando o anúncio no Mercado Livre",
        "Escrevendo a descrição",
        "Conferindo o anúncio na loja",
      ];
}

const STEP_MS = 1300;
const CONFETTI_COLORS = ["#FF6A00", "#FF9248", "#FFD166", "#FFFFFF", "#2BD576"];

function Confetti() {
  // Posições fixas por render (sem Math.random no SSR).
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const angle = (i / 46) * Math.PI * 2;
        const dist = 120 + ((i * 37) % 110);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 60,
          r: (i * 53) % 360,
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          d: (i % 7) * 25,
          w: 6 + (i % 3) * 2,
        };
      }),
    [],
  );
  return (
    <div className="pp-confetti pointer-events-none absolute left-1/2 top-[22%]" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              "--x": `${p.x}px`,
              "--y": `${p.y}px`,
              "--r": `${p.r}deg`,
              background: p.c,
              width: p.w,
              height: p.w * 0.45,
              animationDelay: `${p.d}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// Erro em português (motivo + o que fazer), igual à caixa de erro da tela —
// nunca o JSON cru da API.
function ErrorText({ marketplace, raw }: { marketplace: PublishMarketplace; raw: string }) {
  const { reason, fix } = explainPublishError(marketplace, raw);
  return (
    <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto text-[12.5px] leading-snug">
      <p className="text-muted-foreground">{reason}</p>
      {fix && (
        <p className="text-foreground/85">
          <span className="font-semibold">O que fazer: </span>
          {fix}
        </p>
      )}
    </div>
  );
}

export function PublishProgress({
  state,
  onClose,
}: {
  state: PublishProgressState | null;
  onClose: () => void;
}) {
  const [done, setDone] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const steps = state ? stepsFor(state.marketplace) : [];
  const phase = state?.phase;

  // Avança os passos enquanto publica; o último só fecha com a resposta.
  useEffect(() => {
    if (!state) return;
    if (phase === "running") {
      setDone(0);
      const t = setInterval(() => {
        setDone((d) => Math.min(d + 1, steps.length - 1));
      }, STEP_MS);
      return () => clearInterval(t);
    }
    if (phase === "success") setDone(steps.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state?.marketplace]);

  // Esc fecha quando não está mais publicando.
  useEffect(() => {
    if (!state || phase === "running") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, phase, onClose]);

  if (!mounted || !state) return null;

  const label = LABEL[state.marketplace];
  const progress =
    phase === "success"
      ? 100
      : phase === "error"
        ? (done / steps.length) * 100
        : ((done + 0.6) / steps.length) * 92;

  return createPortal(
    <div
      className="pp-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={
        phase === "success"
          ? `Publicado ${NA[state.marketplace]}`
          : `Publicando ${NA[state.marketplace]}`
      }
    >
      <style>{CSS}</style>
      <div className="pp-card relative w-full max-w-[420px] overflow-hidden rounded-t-3xl border border-border bg-card px-6 pb-7 pt-6 shadow-2xl sm:rounded-3xl">
        {phase === "success" && <Confetti />}

        {/* Produto: a foto em destaque, com o logo da loja onde vai ser publicado */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {state.product.image ? (
              <img
                src={state.product.image}
                alt=""
                className={cn(
                  "size-28 rounded-2xl border border-border bg-white object-cover shadow-lg sm:size-32",
                  phase === "running" && "pp-float",
                )}
              />
            ) : (
              <div className="size-28 rounded-2xl bg-muted sm:size-32" />
            )}
            <span
              className={cn(
                "absolute -bottom-2.5 -right-2.5 grid size-11 place-items-center rounded-xl border-2 border-card bg-white shadow-md",
                phase === "success" && "pp-pop",
              )}
            >
              <img src={LOGO[state.marketplace]} alt={label} className="size-7 object-contain" />
            </span>
            {phase === "success" && (
              <span className="pp-pop absolute -left-2.5 -top-2.5 grid size-9 place-items-center rounded-full border-2 border-card bg-success text-white shadow-md">
                <Check className="size-5" strokeWidth={3} />
              </span>
            )}
          </div>
          <p className="mt-4 line-clamp-2 max-w-[320px] text-[14px] font-medium leading-snug text-foreground">
            {state.product.title}
          </p>
          {state.product.priceCents > 0 && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {formatBRL(state.product.priceCents)}
            </p>
          )}
        </div>

        {/* Resultado / título */}
        {phase === "success" ? (
          <div className="pp-pop mt-5 flex flex-col items-center text-center">
            <p className="text-[21px] font-semibold tracking-tight text-foreground">
              Publicado {NA[state.marketplace]}! 🎉
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Seu anúncio já está na sua loja.
            </p>
          </div>
        ) : phase === "error" ? (
          <div className="pp-pop mt-6 flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-destructive/15 text-destructive">
              <X className="size-7" strokeWidth={2.5} />
            </span>
            <p className="mt-3 text-[17px] font-semibold text-foreground">
              Não deu pra publicar agora
            </p>
            {state.error && <ErrorText marketplace={state.marketplace} raw={state.error} />}
          </div>
        ) : (
          <p className="mt-5 text-[15px] font-semibold text-foreground">
            Publicando {NA[state.marketplace]}…
          </p>
        )}

        {/* Passos */}
        {phase !== "success" && (
          <ul className="mt-4 space-y-2.5">
            {steps.map((s, i) => {
              const isDone = i < done;
              const isNow = i === done && phase === "running";
              const failed = i === done && phase === "error";
              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-3 text-[13px] transition-colors duration-300",
                    isDone
                      ? "text-foreground"
                      : isNow
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-300",
                      isDone && "border-success bg-success text-white",
                      isNow && "border-brand",
                      failed && "border-destructive bg-destructive text-white",
                      !isDone && !isNow && !failed && "border-border",
                    )}
                  >
                    {isDone ? (
                      <Check className="pp-tick size-3" strokeWidth={3} />
                    ) : failed ? (
                      <X className="size-3" strokeWidth={3} />
                    ) : isNow ? (
                      <span className="pp-spin block size-3 rounded-full border-2 border-brand border-t-transparent" />
                    ) : null}
                  </span>
                  {s}
                </li>
              );
            })}
          </ul>
        )}

        {/* Barra */}
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              phase === "error"
                ? "bg-destructive"
                : phase === "success"
                  ? "bg-success"
                  : "pp-shine bg-brand",
            )}
            style={{ width: `${Math.max(6, progress)}%` }}
          />
        </div>

        {/* Ações */}
        {phase !== "running" && (
          <div className="pp-pop mt-6 flex flex-col gap-2 sm:flex-row">
            {phase === "success" && state.viewUrl && (
              <Button asChild className="flex-1 gap-1.5">
                <a href={state.viewUrl} target="_blank" rel="noopener noreferrer">
                  Ver anúncio <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
            <Button
              variant={phase === "success" && state.viewUrl ? "outline" : "default"}
              className="flex-1"
              onClick={onClose}
            >
              {phase === "success" ? "Continuar" : "Fechar"}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.pp-backdrop{animation:pp-fade .25s ease-out}
.pp-card{animation:pp-up .45s cubic-bezier(.2,.8,.2,1)}
@keyframes pp-fade{from{opacity:0}to{opacity:1}}
@keyframes pp-up{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
.pp-float{animation:pp-float 1.8s ease-in-out infinite}
@keyframes pp-float{50%{transform:translateY(-4px) rotate(-2deg)}}
.pp-spin{animation:pp-spin .8s linear infinite}
@keyframes pp-spin{to{transform:rotate(360deg)}}
.pp-tick{animation:pp-tick .35s cubic-bezier(.2,.8,.2,1.4)}
@keyframes pp-tick{from{transform:scale(0)}to{transform:scale(1)}}
.pp-pop{animation:pp-pop .5s cubic-bezier(.2,.8,.2,1.2)}
@keyframes pp-pop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
.pp-ring{box-shadow:0 0 0 0 rgba(43,213,118,.55);animation:pp-ring 1.4s ease-out .2s 2}
@keyframes pp-ring{to{box-shadow:0 0 0 22px rgba(43,213,118,0)}}
.pp-shine{background-image:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);background-size:60% 100%;background-repeat:no-repeat;animation:pp-shine 1.2s linear infinite}
@keyframes pp-shine{from{background-position:-60% 0}to{background-position:160% 0}}
.pp-confetti span{position:absolute;left:0;top:0;border-radius:2px;opacity:0;animation:pp-burst 1.6s cubic-bezier(.15,.7,.3,1) forwards}
@keyframes pp-burst{0%{opacity:1;transform:translate(0,0) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--x),calc(var(--y) + 140px)) rotate(var(--r))}}
@media (prefers-reduced-motion: reduce){
  .pp-backdrop,.pp-card,.pp-float,.pp-tick,.pp-pop,.pp-ring,.pp-shine{animation:none!important}
  .pp-confetti{display:none}
}
`;
