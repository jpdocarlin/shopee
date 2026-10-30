import { createFileRoute } from "@tanstack/react-router";

import { Check, ThanksLayout } from "@/components/obrigado/thanks-layout";

// Fim do funil pra quem recusou o Acelerador ("Não, obrigado").
// Texto exato pedido pelo Jp — não acrescentar nada.
export const Route = createFileRoute("/obrigado/")({
  head: () => ({ meta: [{ title: "Shoppfy" }] }),
  component: ObrigadoPage,
});

function ObrigadoPage() {
  return (
    <ThanksLayout>
      <Check />
      <h1 className="mt-8 max-w-[640px] text-[clamp(28px,4.6vw,44px)] font-bold leading-[1.1] tracking-[-0.04em]">
        Mande o comprovante de pagamento para a pessoa que te mandou o link do fornecedor para
        receber o acesso ao sistema do fornecedor
      </h1>
    </ThanksLayout>
  );
}
