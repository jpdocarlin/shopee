import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

import { DEMO_PRODUCTS } from "@/data/demo-products";
import { formatBRL } from "@/lib/format";
import { useIsOwner } from "@/lib/owner";
import { useAffiliateStore } from "@/stores/affiliate-store";
import { useDemoBoostStore } from "@/stores/demo-boost-store";

const DELAY_MS = 10_000; // espera até a notificação cair
const VISIBLE_MS = 5_000; // quanto tempo ela fica na tela

// Som de venda aprovada ("ka-ching") sintetizado na hora com a Web Audio API —
// sem arquivo de áudio, sem download, sem depender de CDN. O AudioContext é
// criado no clique (gesto do usuário), então tocar o som 10s depois já sai
// liberado pelo navegador.
//
// É montado em duas camadas, como um caixa registradora de verdade:
//   1. um estalo curto de ruído filtrado — o mecanismo/gaveta;
//   2. dois sinos em intervalo ascendente, cada um com parciais inarmônicos
//      (1 / 2.76 / 5.4), que é o que faz o ouvido reconhecer "sino" em vez de
//      "bip". Só oscilador puro soava sintético demais.
function createCashSound(): () => void {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};

  const ctx = new Ctx();
  void ctx.resume();

  return () => {
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    // 1) Estalo do mecanismo: ruído branco decaindo rápido, passado por um
    // bandpass agudo pra soar metálico em vez de "chiado".
    const noiseLen = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen) ** 2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    noise.connect(bandpass).connect(noiseGain).connect(master);
    noise.start(now);

    // 2) Os dois sinos.
    const PARTIALS: Array<[ratio: number, gain: number, decay: number]> = [
      [1, 1, 1],
      [2.76, 0.45, 0.7],
      [5.4, 0.18, 0.45],
    ];

    const bell = (freq: number, start: number, dur: number, gain: number) => {
      for (const [ratio, partialGain, decayScale] of PARTIALS) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * ratio;
        const peak = gain * partialGain;
        const life = dur * decayScale;
        env.gain.setValueAtTime(0.0001, now + start);
        env.gain.exponentialRampToValueAtTime(peak, now + start + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, now + start + life);
        osc.connect(env).connect(master);
        osc.start(now + start);
        osc.stop(now + start + life + 0.05);
      }
    };

    bell(1318.51, 0.01, 1.0, 0.22); // E6
    bell(1975.53, 0.14, 1.5, 0.19); // B6 — quinta acima, dá o "ka-CHING"

    // Fecha o contexto depois que o som acabou, pra não deixar áudio aberto à toa.
    window.setTimeout(() => void ctx.close(), 2500);
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
      {/* Discreta de propósito: nada muda de aparência no clique (sem pulso,
          sem cor, sem tooltip) — quem está assistindo a demonstração não pode
          perceber que o botão foi acionado. O único retorno é a venda caindo
          10 segundos depois. */}
      <button
        type="button"
        onClick={handleClick}
        aria-label="Simular venda aprovada"
        className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card"
      >
        <span className="size-2 rounded-full bg-muted-foreground/50" />
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
