import { createFileRoute } from "@tanstack/react-router";

import { Check, Step, ThanksLayout } from "@/components/obrigado/thanks-layout";

// Fim do funil pra quem recusou o Acelerador ("Não, obrigado").
export const Route = createFileRoute("/obrigado/")({
  head: () => ({ meta: [{ title: "Compra confirmada · Shoppfy" }] }),
  component: ObrigadoPage,
});

function ObrigadoPage() {
  return (
    <ThanksLayout>
      <Check />
      <h1 className="mt-8 text-[clamp(36px,6vw,56px)] font-bold leading-[1.04] tracking-[-0.045em]">
        Compra confirmada.
        <br />
        <span className="text-[#6E6E73]">Falta só um passo.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[19px] leading-snug text-[#A1A1A6]">
        Mande o comprovante de pagamento para a pessoa que te chamou para receber o acesso ao
        sistema do fornecedor.
      </p>

      <div className="mt-10 rounded-[22px] border border-[#1F1F1F] bg-[#0A0A0A] px-6">
        <Step n={1}>Tire um print ou salve o comprovante do pagamento.</Step>
        <Step n={2}>
          Envie o comprovante para <span className="text-[#F5F5F7]">a pessoa que te chamou</span> —
          é ela quem libera o seu acesso ao sistema do fornecedor.
        </Step>
        <Step n={3}>Confira seu e-mail: os dados de acesso da Shoppfy chegam lá.</Step>
      </div>
    </ThanksLayout>
  );
}
