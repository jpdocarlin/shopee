import { createFileRoute } from "@tanstack/react-router";

import { Check, ThanksLayout } from "@/components/obrigado/thanks-layout";

// Página pública de fim da conexão feita pelo "link pra janela anônima"
// (Integrações → Conectar → Abrir numa janela anônima). Nessa janela a pessoa
// não está logada na Shoppfy, então só avisa que deu certo — a aba original
// da Shoppfy percebe a conexão sozinha. Ver connect-redirect.server.ts.
type Search = { loja?: string; status?: string };

export const Route = createFileRoute("/conectado")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    loja: typeof s.loja === "string" ? s.loja : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Shoppfy" }, { name: "robots", content: "noindex" }] }),
  component: ConectadoPage,
});

function ConectadoPage() {
  const { loja, status } = Route.useSearch();
  const nome = loja === "mercado-livre" ? "Mercado Livre" : "Shopee";
  const ok = status === "ok";
  return (
    <ThanksLayout>
      {ok ? (
        <Check />
      ) : (
        <span className="grid size-12 place-items-center rounded-full border border-[#2A2A2A] text-[22px] text-[#F5F5F7]">
          !
        </span>
      )}
      <h1 className="mt-8 max-w-[640px] text-[clamp(28px,4.6vw,44px)] font-bold leading-[1.1] tracking-[-0.04em]">
        {ok ? `Loja ${nome} conectada` : `Não deu pra conectar a loja ${nome}`}
      </h1>
      <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-[#A1A1A6]">
        {ok
          ? "Pode fechar esta janela e voltar pra Shoppfy. A tela de Integrações já atualiza sozinha."
          : "Feche esta janela, volte pra Shoppfy e gere um link novo em Integrações → Conectar."}
      </p>
    </ThanksLayout>
  );
}
