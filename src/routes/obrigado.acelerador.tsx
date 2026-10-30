import { createFileRoute } from "@tanstack/react-router";

import { Check, Step, ThanksLayout } from "@/components/obrigado/thanks-layout";

// Fim do funil pra quem comprou o Acelerador: o comprovante vai direto pro Jp,
// que é quem conduz as calls (mesmo quando a venda veio de um afiliado).
const JP_WHATSAPP = "5511991177213";
const MESSAGE =
  "Oi, Jp! Acabei de entrar no Acelerador Shoppfy. Segue o meu comprovante de pagamento:";
const WHATSAPP_URL = `https://wa.me/${JP_WHATSAPP}?text=${encodeURIComponent(MESSAGE)}`;

export const Route = createFileRoute("/obrigado/acelerador")({
  head: () => ({ meta: [{ title: "Você está no Acelerador · Shoppfy" }] }),
  component: ObrigadoAceleradorPage,
});

function ObrigadoAceleradorPage() {
  return (
    <ThanksLayout>
      <Check />
      <p className="mt-8 text-[13px] font-semibold text-[#A1A1A6]">Acelerador Shoppfy · 30 dias</p>
      <h1 className="mt-3 text-[clamp(36px,6vw,56px)] font-bold leading-[1.04] tracking-[-0.045em]">
        Você está dentro.
        <br />
        <span className="text-[#6E6E73]">Falta só um passo.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[19px] leading-snug text-[#A1A1A6]">
        Mande o comprovante de pagamento direto para o{" "}
        <span className="text-[#F5F5F7]">Jp Nogueiraz</span> no WhatsApp. É ele quem conduz as calls
        e confirma a sua vaga na turma.
      </p>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-10 flex w-full max-w-[440px] items-center justify-center gap-2.5 rounded-full bg-[#F5F5F7] px-6 py-[18px] text-[17px] font-semibold tracking-[-0.02em] text-black transition-transform hover:scale-[1.015] active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.1c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.28-.68-2.78-1.1-4.55-3.94-4.69-4.12-.13-.18-1.12-1.49-1.12-2.84s.71-2.01.96-2.29c.25-.27.55-.34.73-.34h.52c.17 0 .4-.06.62.48.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.12.59-.07.16-.18.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.76 1.87.89.27.14.46.2.52.32.07.11.07.66-.17 1.34Z" />
        </svg>
        Enviar comprovante para o Jp
      </a>
      <p className="mt-3 text-[13px] text-[#6E6E73]">
        WhatsApp (11) 99117-7213 · mensagem já pronta
      </p>

      <div className="mt-12 rounded-[22px] border border-[#1F1F1F] bg-[#0A0A0A] px-6">
        <Step n={1}>Clique no botão acima e anexe o comprovante na conversa.</Step>
        <Step n={2}>
          Confira seu e-mail: chegou a confirmação do Acelerador e, assim que a sua turma estiver
          pronta, o link do grupo do WhatsApp.
        </Step>
        <Step n={3}>
          As calls ao vivo são <span className="text-[#F5F5F7]">toda quarta às 20h</span>. Seu
          acesso à Shoppfy já está liberado.
        </Step>
      </div>
    </ThanksLayout>
  );
}
