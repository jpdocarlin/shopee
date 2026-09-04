import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Chrome, Download, Loader2, Plug, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/translations";
import { getShopeeStatus } from "@/lib/shopee.functions";

export const Route = createFileRoute("/_shell/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações · Shoppfy" },
      {
        name: "description",
        content: "APIs, webhooks, automações e conexões com ferramentas externas.",
      },
      { property: "og:title", content: "Integrações · Shoppfy" },
      {
        property: "og:description",
        content: "APIs, webhooks, automações e conexões com ferramentas externas.",
      },
    ],
  }),
  component: IntegracoesPage,
});

const INSTALL_STEPS = [
  {
    title: "Baixe e descompacte",
    description:
      'Clique em "Baixar extensão" e descompacte o arquivo .zip em alguma pasta fixa do computador.',
  },
  {
    title: "Abra as extensões do Chrome",
    description:
      'Acesse chrome://extensions e ative o "Modo do desenvolvedor" no canto superior direito.',
  },
  {
    title: "Carregue sem compactação",
    description:
      'Clique em "Carregar sem compactação" e selecione a pasta "shopfy-extension" que você descompactou.',
  },
  {
    title: "Pronto",
    description:
      'Entre em qualquer produto da Shopee e clique no botão "Virar afiliado (Shopfy)" — o link cai sozinho em Meus Links.',
  },
];

type ShopeeStatus =
  | { loading: true }
  | { loading: false; connected: false }
  | { loading: false; connected: true; shopId: number; environment: "sandbox" | "live" };

function IntegracoesPage() {
  const t = useT();
  const [shopeeStatus, setShopeeStatus] = useState<ShopeeStatus>({ loading: true });

  useEffect(() => {
    // Feedback do redirect de volta do OAuth da Shopee (?shopee=connected|error).
    const params = new URLSearchParams(window.location.search);
    const result = params.get("shopee");
    if (result === "connected") {
      toast.success("Loja Shopee conectada", { description: "A API oficial já pode ser usada." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      toast.error("Não deu pra conectar a loja Shopee agora", {
        description: "Tente de novo em instantes.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    getShopeeStatus()
      .then((res) => setShopeeStatus({ loading: false, ...res }))
      .catch(() => setShopeeStatus({ loading: false, connected: false }));
  }, []);

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Integrações")}
        description={t("APIs, webhooks, automações e conexões com ferramentas externas.")}
      />

      <Reveal className="surface-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-foreground">
              <Zap className="size-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-foreground">Shopee — API oficial</h3>
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-500">
                  Beta · sandbox
                </span>
              </div>
              <p className="max-w-lg text-[13px] text-muted-foreground">
                Conecta sua loja direto pela API da Shopee Open Platform, sem depender da extensão.
                Por enquanto só funciona em ambiente de teste, até a Shopee aprovar o app pra
                produção (Go-Live).
              </p>
            </div>
          </div>
          {shopeeStatus.loading ? (
            <Button size="sm" variant="outline" disabled className="shrink-0 gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Verificando…
            </Button>
          ) : shopeeStatus.connected ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12.5px] font-medium text-emerald-500">
              <CheckCircle2 className="size-3.5" />
              Loja {shopeeStatus.shopId} conectada
            </span>
          ) : (
            <Button asChild size="sm" className="shrink-0">
              <a href="/api/shopee/connect">
                <Zap className="size-3.5" />
                Conectar loja Shopee
              </a>
            </Button>
          )}
        </div>
      </Reveal>

      <Reveal className="surface-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-foreground">
              <Chrome className="size-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Extensão Shopfy pro Chrome
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[10.5px] font-medium text-brand">
                  <Sparkles className="size-2.5" />
                  Automático
                </span>
              </div>
              <p className="max-w-lg text-[13px] text-muted-foreground">
                Clique em "Virar afiliado" em qualquer produto da Shopee e o link já cai em Meus
                Links, sem copiar e colar nada.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <a href="/shopfy-extension.zip" download>
              <Download className="size-3.5" />
              Baixar extensão
            </a>
          </Button>
        </div>

        <div className="border-t border-border px-5 py-4">
          <p className="mb-3 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Como instalar
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {INSTALL_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[10.5px] font-semibold text-brand">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">{step.title}</p>
                  <p className="text-[12px] text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11.5px] text-muted-foreground">
            A extensão ainda não está na Chrome Web Store (isso exige revisão da Google), então
            precisa ser instalada manualmente uma vez, como extensão "descompactada". Você também
            precisa estar logado no Portal de Afiliados da Shopee no mesmo navegador.
          </p>
        </div>
      </Reveal>

      <ModulePlaceholder
        icon={Plug}
        title="Ecossistema aberto"
        summary="Conecte o Shoppfy ao restante da sua stack."
        capabilities={[
          "Chaves de API",
          "Webhooks",
          "Automações",
          "Logs de eventos",
          "Aplicativos conectados",
        ]}
      />
    </div>
  );
}
