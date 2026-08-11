import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

import { DEMO_PRODUCTS } from "@/data/demo-products";
import { formatBRL } from "@/lib/format";
import { useIsOwner } from "@/lib/owner";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useDemoBoostStore } from "@/stores/demo-boost-store";
import { cn } from "@/lib/utils";

const DELAY_MS = 10_000; // espera até a notificação cair
const VISIBLE_MS = 5_000; // quanto tempo ela fica na tela

// "Cha-ching" sintetizado na hora com a Web Audio API — sem arquivo de áudio,
// sem download, sem depender de CDN. O AudioContext é criado no clique (gesto
// do usuário), então tocar o som 10s depois já sai liberado pelo navegador.
function createCashSound(): () => void {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};

  const ctx = new Ctx();
  void ctx.resume();

  return () => {
    const now = ctx.currentTime;
    // Duas batidas metálicas em sequência, a segunda mais aguda — é o que dá a
    // impressão de "caixa registradora".
    const notes: Array<[freq: number, start: number, dur: number, gain: number]> = [
      [1046, 0, 0.18, 0.28],
      [1568, 0.07, 0.5, 0.22],
      [2093, 0.09, 0.45, 0.12],
    ];

    for (const [freq, start, dur, gain] of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, now + start);
      env.gain.exponentialRampToValueAtTime(gain, now + start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(env).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }

    // Fecha o contexto depois que o som acabou, pra não deixar áudio aberto à toa.
    window.setTimeout(() => void ctx.close(), 1500);
  };
}

type Sale = {
  id: string;
  productTitle: string;
  amountCents: number;
};

export function SaleDemoButton() {
  const isOwner = useIsOwner();
  const links = useAffiliateStore((s) => s.links);
  const addSale = useDemoBoostStore((s) => s.addSale);

  const [pending, setPending] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    // Limpa os timers se o componente sair da tela no meio da contagem.
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!isOwner) return null;

  // Produto da venda = o último link de afiliado salvo/copiado.
  const lastLink = Object.entries(links).sort(
    ([, a], [, b]) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  )[0];

  const handleClick = () => {
    if (pending) return;

    if (!lastLink) {
      toast.info("Copie o link de afiliado de um produto primeiro", {
        description: "A venda cai em cima do último produto que você pegou o link.",
      });
      return;
    }

    const [productId, link] = lastLink;
    const product = DEMO_PRODUCTS.find((p) => p.id === productId);
    const productTitle = product?.title ?? link.meta?.title ?? "Produto";
    const amountCents = product ? Math.round(product.priceCents * product.commissionRate) : 1290;

    // Cria o áudio já no clique — gesto do usuário destrava o som.
    const playSound = createCashSound();
    setPending(true);

    timersRef.current.push(
      window.setTimeout(() => {
        playSound();
        addSale(amountCents, productTitle, "Facebook");
        setSale({ id: `sale-${Date.now()}`, productTitle, amountCents });
        setPending(false);

        timersRef.current.push(window.setTimeout(() => setSale(null), VISIBLE_MS));
      }, DELAY_MS),
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Simular venda aprovada"
        title={pending ? "Venda a caminho…" : "Simular uma venda aprovada do último link copiado"}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card transition-colors hover:border-success/50",
          pending && "border-success/60",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full bg-muted-foreground/50 transition-colors",
            pending && "animate-pulse bg-success",
          )}
        />
      </button>

      {/* Portal pro body: o header tem backdrop-blur, e um ancestral com
          backdrop-filter vira o bloco de referência do position:fixed — sem o
          portal a notificação grudava no header em vez do canto da tela. */}
      {sale &&
        createPortal(
          <div
            role="status"
            className="fixed right-4 top-4 z-[60] w-[min(20rem,calc(100vw-2rem))] animate-in slide-in-from-top-2 fade-in duration-300"
          >
            <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-card p-3.5 shadow-lg shadow-black/30">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">Venda aprovada</p>
                  <button
                    type="button"
                    onClick={() => setSale(null)}
                    aria-label="Fechar"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">via Facebook</p>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-foreground">
                  {sale.productTitle}
                </p>
                <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-success">
                  + {formatBRL(sale.amountCents)}
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
