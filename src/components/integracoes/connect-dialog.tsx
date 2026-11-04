// 04/11/2026: depois de desconectar, "Conectar" caía direto na loja antiga —
// a Shopee e o Mercado Livre usam a conta que já está logada no navegador (e o
// ML, se essa conta já autorizou o app, volta sem mostrar tela nenhuma).
// Agora "Conectar" abre esta escolha:
//   1. Usar a conta logada neste navegador (fluxo de antes);
//   2. Mercado Livre: entrar com outra conta (passa pelo logout do ML antes);
//   3. Abrir numa janela anônima: copia um link de conexão; a pessoa cola numa
//      janela anônima, entra com a loja que quiser, e esta tela percebe a
//      conexão sozinha (consulta o status a cada 3s).
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, LogOut, MonitorSmartphone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createShopeeConnectState, getShopeeStatus } from "@/lib/shopee.functions";
import {
  createMercadoLivreConnectState,
  getMercadoLivreStatus,
} from "@/lib/mercadolivre.functions";
import { cn } from "@/lib/utils";

export type ConnectMarketplace = "shopee" | "mercado-livre";

const NAME: Record<ConnectMarketplace, string> = {
  shopee: "Shopee",
  "mercado-livre": "Mercado Livre",
};
const NA: Record<ConnectMarketplace, string> = {
  shopee: "na Shopee",
  "mercado-livre": "no Mercado Livre",
};
const A: Record<ConnectMarketplace, string> = {
  shopee: "A Shopee",
  "mercado-livre": "O Mercado Livre",
};
const PATH: Record<ConnectMarketplace, string> = {
  shopee: "/api/shopee/connect",
  "mercado-livre": "/api/mercado-livre/connect",
};
const LINK_TTL_MS = 10 * 60 * 1000; // mesmo prazo do state no servidor
const POLL_MS = 3000;

async function newState(m: ConnectMarketplace): Promise<string> {
  const { token } =
    m === "shopee" ? await createShopeeConnectState() : await createMercadoLivreConnectState();
  return token;
}

async function isConnected(m: ConnectMarketplace) {
  return m === "shopee" ? getShopeeStatus() : getMercadoLivreStatus();
}

function Option({
  icon: Icon,
  title,
  desc,
  onClick,
  busy,
  disabled,
}: {
  icon: typeof UserRound;
  title: string;
  desc: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors",
        "hover:border-brand/50 hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
          {desc}
        </span>
      </span>
    </button>
  );
}

export function ConnectDialog({
  marketplace,
  onOpenChange,
  onConnected,
}: {
  marketplace: ConnectMarketplace | null;
  onOpenChange: (open: boolean) => void;
  onConnected: (m: ConnectMarketplace) => void;
}) {
  const m = marketplace ?? "shopee";
  const [busy, setBusy] = useState<"logada" | "outra" | "link" | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Zera tudo ao abrir/fechar ou trocar de loja.
  useEffect(() => {
    setBusy(null);
    setLink(null);
    setCopied(false);
    setExpired(false);
  }, [marketplace]);

  // Com o link gerado, fica conferindo se a loja já conectou (na outra janela).
  useEffect(() => {
    if (!link || !marketplace) return;
    const tick = async () => {
      if (Date.now() > link.expiresAt) {
        setExpired(true);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await isConnected(marketplace);
        if (res.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          onConnected(marketplace);
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    pollRef.current = setInterval(() => void tick(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [link, marketplace, onConnected]);

  async function go(kind: "logada" | "outra") {
    setBusy(kind);
    try {
      const token = await newState(m);
      const url = new URL(PATH[m], window.location.origin);
      url.searchParams.set("state", token);
      if (kind === "outra") url.searchParams.set("conta", "outra");
      window.location.href = url.toString();
    } catch {
      setBusy(null);
      toast.error(
        `Não deu pra iniciar a conexão com ${A[m].replace(/^./, (c) => c.toLowerCase())}`,
        {
          description: "Tente de novo em instantes.",
        },
      );
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
    } catch {
      setCopied(false);
      toast.message("Copie o link abaixo", {
        description: "Seu navegador não deixou copiar sozinho.",
      });
    }
  }

  async function makeLink() {
    setBusy("link");
    try {
      const token = await newState(m);
      const url = new URL(PATH[m], window.location.origin);
      url.searchParams.set("state", token);
      url.searchParams.set("via", "link");
      const next = { url: url.toString(), expiresAt: Date.now() + LINK_TTL_MS };
      setExpired(false);
      setLink(next);
      await copy(next.url);
    } catch {
      toast.error("Não deu pra gerar o link agora", { description: "Tente de novo em instantes." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={marketplace !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <img
              src={m === "shopee" ? "/logo-shopee.png" : "/logo-mercadolivre.png"}
              alt=""
              className="size-6 rounded object-contain"
            />
            Conectar loja {NAME[m]}
          </DialogTitle>
          <DialogDescription>
            {link
              ? "Conecte pela janela anônima — esta tela atualiza sozinha quando terminar."
              : `${A[m]} abre com a conta que já está logada neste navegador. Escolha qual loja você quer conectar:`}
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="space-y-2.5">
            <Option
              icon={UserRound}
              title="Usar a conta logada neste navegador"
              desc={`Se a loja que você quer já está logada ${NA[m]} aqui.`}
              busy={busy === "logada"}
              disabled={busy !== null}
              onClick={() => void go("logada")}
            />
            {m === "mercado-livre" && (
              <Option
                icon={LogOut}
                title="Entrar com outra conta"
                desc="Sai da conta do Mercado Livre neste navegador e você entra com a loja que quiser."
                busy={busy === "outra"}
                disabled={busy !== null}
                onClick={() => void go("outra")}
              />
            )}
            <Option
              icon={MonitorSmartphone}
              title="Abrir numa janela anônima"
              desc={`Funciona sempre: copiamos um link, você cola numa janela anônima e entra com a loja que quiser${m === "shopee" ? "" : ", sem sair da conta daqui"}.`}
              busy={busy === "link"}
              disabled={busy !== null}
              onClick={() => void makeLink()}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2.5 text-[13px] text-muted-foreground">
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                  1
                </span>
                <span>
                  Abra uma <b className="text-foreground">janela anônima</b>: no computador{" "}
                  <b className="text-foreground">Ctrl+Shift+N</b> (Mac:{" "}
                  <b className="text-foreground">⌘+Shift+N</b>); no celular, “Nova guia anônima” no
                  menu do navegador.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                  2
                </span>
                <span>Cole o link e entre com a loja {NAME[m]} que você quer conectar.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                  3
                </span>
                <span>Volte aqui — a conexão aparece sozinha.</span>
              </li>
            </ol>

            <div className="flex gap-2">
              <Input
                readOnly
                value={link.url}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 text-[12px]"
              />
              <Button
                size="sm"
                variant={copied ? "outline" : "default"}
                className="h-9 shrink-0 gap-1.5"
                onClick={() => void copy(link.url)}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>

            {expired ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
                O link expirou (vale 10 minutos).
                <Button size="sm" variant="outline" className="h-7" onClick={() => void makeLink()}>
                  Gerar outro
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Esperando a conexão… o link vale 10 minutos e só pode ser usado uma vez.
              </p>
            )}

            <button
              type="button"
              className="text-[12.5px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setLink(null);
                setExpired(false);
              }}
            >
              Voltar às opções
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
