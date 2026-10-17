import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Copy, Loader2, MapPin, Plug, Unplug, Zap } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/translations";
import {
  createShopeeConnectState,
  disconnectShopee,
  getShopeeStatus,
} from "@/lib/shopee.functions";
import {
  createMercadoLivreConnectState,
  disconnectMercadoLivre,
  getMercadoLivreStatus,
} from "@/lib/mercadolivre.functions";

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

// Endereço público da C7Drop (fornecedora de dropshipping) — usado como
// origem/expedição ao configurar a loja na Shopee, já que os produtos saem
// direto do estoque dela. Fonte: rodapé/página de contato de c7drop.com.br.
const C7DROP_ADDRESS = "Parque Dom Pedro II, 268 — Apto 22, Centro, São Paulo - SP, 01022-050";

type ShopeeStatus =
  | { loading: true }
  | { loading: false; connected: false }
  | { loading: false; connected: true; shopId: number; environment: "sandbox" | "live" };

type MercadoLivreStatus =
  | { loading: true }
  | { loading: false; connected: false }
  | { loading: false; connected: true; sellerId: number };

function IntegracoesPage() {
  const t = useT();
  const [shopeeStatus, setShopeeStatus] = useState<ShopeeStatus>({ loading: true });
  const [connectingShopee, setConnectingShopee] = useState(false);
  const [mlStatus, setMlStatus] = useState<MercadoLivreStatus>({ loading: true });
  const [connectingMl, setConnectingMl] = useState(false);
  const [disconnectingShopee, setDisconnectingShopee] = useState(false);
  const [disconnectingMl, setDisconnectingMl] = useState(false);

  async function handleDisconnectShopee() {
    const ok = window.confirm(
      "Desconectar sua loja Shopee?\n\nSeus anúncios que já estão na Shopee continuam no ar. Você só não vai conseguir publicar novos até conectar de novo.",
    );
    if (!ok) return;
    setDisconnectingShopee(true);
    try {
      await disconnectShopee();
      setShopeeStatus({ loading: false, connected: false });
      toast.success("Loja Shopee desconectada");
    } catch {
      toast.error("Não deu pra desconectar agora", { description: "Tente de novo em instantes." });
    } finally {
      setDisconnectingShopee(false);
    }
  }

  async function handleDisconnectMercadoLivre() {
    const ok = window.confirm(
      "Desconectar sua loja do Mercado Livre?\n\nSeus anúncios que já estão no Mercado Livre continuam no ar. Você só não vai conseguir publicar novos até conectar de novo.",
    );
    if (!ok) return;
    setDisconnectingMl(true);
    try {
      await disconnectMercadoLivre();
      setMlStatus({ loading: false, connected: false });
      toast.success("Loja Mercado Livre desconectada");
    } catch {
      toast.error("Não deu pra desconectar agora", { description: "Tente de novo em instantes." });
    } finally {
      setDisconnectingMl(false);
    }
  }

  async function handleConnectShopee() {
    setConnectingShopee(true);
    try {
      const { token } = await createShopeeConnectState();
      window.location.href = `/api/shopee/connect?state=${encodeURIComponent(token)}`;
    } catch {
      setConnectingShopee(false);
      toast.error("Não deu pra iniciar a conexão com a Shopee", {
        description: "Tente de novo em instantes.",
      });
    }
  }

  async function handleConnectMercadoLivre() {
    setConnectingMl(true);
    try {
      const { token } = await createMercadoLivreConnectState();
      window.location.href = `/api/mercado-livre/connect?state=${encodeURIComponent(token)}`;
    } catch {
      setConnectingMl(false);
      toast.error("Não deu pra iniciar a conexão com o Mercado Livre", {
        description: "Tente de novo em instantes.",
      });
    }
  }

  useEffect(() => {
    // Feedback do redirect de volta do OAuth da Shopee (?shopee=connected|error)
    // e do Mercado Livre (?ml=connected|error).
    const params = new URLSearchParams(window.location.search);
    const shopeeResult = params.get("shopee");
    if (shopeeResult === "connected") {
      toast.success("Loja Shopee conectada", { description: "A API oficial já pode ser usada." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (shopeeResult === "error") {
      toast.error("Não deu pra conectar a loja Shopee agora", {
        description: "Tente de novo em instantes.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    const mlResult = params.get("ml");
    if (mlResult === "connected") {
      toast.success("Loja Mercado Livre conectada", {
        description: "A API oficial já pode ser usada.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (mlResult === "error") {
      toast.error("Não deu pra conectar a loja Mercado Livre agora", {
        description: "Tente de novo em instantes.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    getShopeeStatus()
      .then((res) => setShopeeStatus({ loading: false, ...res }))
      .catch(() => setShopeeStatus({ loading: false, connected: false }));

    getMercadoLivreStatus()
      .then((res) => setMlStatus({ loading: false, ...res }))
      .catch(() => setMlStatus({ loading: false, connected: false }));
  }, []);

  async function handleCopyC7DropAddress() {
    try {
      await navigator.clipboard.writeText(C7DROP_ADDRESS);
      toast.success("Endereço copiado");
    } catch {
      toast.error("Não deu pra copiar o endereço");
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Integrações")}
        description={t("APIs, webhooks, automações e conexões com ferramentas externas.")}
      />

      <Reveal className="surface-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
              <img src="/logo-shopee.png" alt="Shopee" className="size-8 object-contain" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-foreground">Shopee — API oficial</h3>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-500">
                  Ao vivo
                </span>
              </div>
              <p className="max-w-lg text-[13px] text-muted-foreground">
                Conecta sua loja direto pela API oficial da Shopee Open Platform. Já em produção
                (Go-Live aprovado pela Shopee) — os produtos publicados por aqui vão direto pra loja
                de verdade.
              </p>
            </div>
          </div>
          {shopeeStatus.loading ? (
            <Button size="sm" variant="outline" disabled className="shrink-0 gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Verificando…
            </Button>
          ) : shopeeStatus.connected ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12.5px] font-medium text-emerald-500">
                <CheckCircle2 className="size-3.5" />
                Loja {shopeeStatus.shopId} conectada
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                disabled={disconnectingShopee}
                onClick={handleDisconnectShopee}
              >
                {disconnectingShopee ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unplug className="size-3.5" />
                )}
                Desconectar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={connectingShopee}
              onClick={handleConnectShopee}
            >
              {connectingShopee ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Conectar loja Shopee
            </Button>
          )}
        </div>
      </Reveal>

      <Reveal className="surface-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-[#ffe600]">
              <img
                src="/logo-mercadolivre.png"
                alt="Mercado Livre"
                className="size-11 object-cover"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-[14px] font-semibold text-foreground">
                Mercado Livre — API oficial
              </h3>
              <p className="max-w-lg text-[13px] text-muted-foreground">
                Conecta sua loja direto pela API do Mercado Livre, no mesmo esquema da Shopee. A
                categoria certa também é detectada automaticamente por produto.
              </p>
            </div>
          </div>
          {mlStatus.loading ? (
            <Button size="sm" variant="outline" disabled className="shrink-0 gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Verificando…
            </Button>
          ) : mlStatus.connected ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12.5px] font-medium text-emerald-500">
                <CheckCircle2 className="size-3.5" />
                Loja conectada
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                disabled={disconnectingMl}
                onClick={handleDisconnectMercadoLivre}
              >
                {disconnectingMl ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unplug className="size-3.5" />
                )}
                Desconectar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={connectingMl}
              onClick={handleConnectMercadoLivre}
            >
              {connectingMl ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              Conectar loja Mercado Livre
            </Button>
          )}
        </div>
      </Reveal>

      <Reveal className="surface-card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-hover text-foreground">
              <MapPin className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[14px] font-semibold text-foreground">
                Endereço de origem (C7Drop)
              </h3>
              <p className="max-w-lg text-[13px] text-muted-foreground">
                Os produtos saem direto do estoque da C7Drop, nossa fornecedora de dropshipping. Use
                esse endereço como origem/expedição ao configurar sua loja na Shopee.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-lg border border-border bg-surface-hover px-3.5 py-2.5 text-[12.5px] leading-snug text-foreground">
              <p className="font-medium">Parque Dom Pedro II, 268 — Apto 22</p>
              <p className="text-muted-foreground">Centro, São Paulo - SP, 01022-050</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleCopyC7DropAddress}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
          </div>
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
