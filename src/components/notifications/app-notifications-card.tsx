import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  BellRing,
  Download,
  EllipsisVertical,
  Loader2,
  Share,
  Smartphone,
  SquarePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPushPublicKey, savePushSubscription, sendTestPush } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

// Cartão do Dashboard: ensina a colocar o Shoppfy na tela inicial (iPhone e
// Android) e liga as notificações de novidades do catálogo (produto novo,
// preço que baixou/subiu, esgotou, voltou ao estoque).

type Platform = "ios" | "android" | "desktop";
type Status = "checking" | "unsupported" | "denied" | "off" | "on";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

// O Chrome do Android dispara esse evento uma vez só, logo no carregamento —
// guarda aqui pra usar no botão "Instalar app".
let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

const DISMISS_KEY = "shoppfy:notif-card-dismissed-at";
const DISMISS_DAYS = 3;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await savePushSubscription({
    data: { endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent },
  });
}

function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function IosSteps() {
  return (
    <ol className="space-y-1.5 text-[12.5px] text-muted-foreground">
      <li>
        1. Abra o <span className="text-foreground">shoppfy.online</span> no{" "}
        <span className="text-foreground">Safari</span> (não funciona pelo Chrome nem pelo
        Instagram).
      </li>
      <li>
        2. Toque em <Share className="inline size-3.5 -translate-y-px text-foreground" />{" "}
        <span className="text-foreground">Compartilhar</span> (quadrado com a setinha pra cima).
      </li>
      <li>
        3. Role e toque em{" "}
        <SquarePlus className="inline size-3.5 -translate-y-px text-foreground" />{" "}
        <span className="text-foreground">Adicionar à Tela de Início</span> → Adicionar.
      </li>
      <li>
        4. Abra o Shoppfy pelo <span className="text-foreground">ícone novo</span>, entre na conta e
        toque em <span className="text-foreground">Ativar notificações</span> aqui.
      </li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-1.5 text-[12.5px] text-muted-foreground">
      <li>
        1. Abra o <span className="text-foreground">shoppfy.online</span> no{" "}
        <span className="text-foreground">Google Chrome</span>.
      </li>
      <li>
        2. Toque nos{" "}
        <EllipsisVertical className="inline size-3.5 -translate-y-px text-foreground" />{" "}
        <span className="text-foreground">três pontinhos</span> no canto de cima.
      </li>
      <li>
        3. Toque em <span className="text-foreground">Instalar app</span> (ou{" "}
        <span className="text-foreground">Adicionar à tela inicial</span>) → Instalar.
      </li>
      <li>
        4. Abra o Shoppfy pelo <span className="text-foreground">ícone novo</span> e toque em{" "}
        <span className="text-foreground">Ativar notificações</span> aqui.
      </li>
    </ol>
  );
}

// variant="card": cartão do Dashboard (fecha, some quando já está ativo).
// variant="page": bloco da página "Aplicativo no celular" (sempre aparece,
// mostra o status e o botão de teste; o passo a passo fica na própria página).
export function AppNotificationsCard({ variant = "card" }: { variant?: "card" | "page" }) {
  const isPage = variant === "page";
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [tab, setTab] = useState<"ios" | "android">("ios");
  const [standalone, setStandalone] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setTab(p === "android" ? "android" : "ios");
    setStandalone(isStandalone());
    setDismissed(wasDismissedRecently());
    setCanInstall(Boolean(deferredPrompt));
    const onPrompt = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", onPrompt);

    let cancelled = false;
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === "granted") {
          // Regrava no servidor (idempotente) — garante que este aparelho está na lista.
          await saveSubscription(existing).catch(() => undefined);
          if (!cancelled) setStatus("on");
          return;
        }
      } catch (err) {
        console.error("[push] falha ao registrar service worker:", err);
      }
      if (!cancelled) setStatus("off");
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    deferredPrompt = null;
    setCanInstall(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await getPushPublicKey();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      await saveSubscription(sub);
      setStatus("on");
      toast.success("Notificações ativadas neste aparelho");
      void sendTestPush().catch(() => undefined);
    } catch (err) {
      console.error("[push] falha ao ativar:", err);
      toast.error("Não deu pra ativar as notificações", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // sem storage: só esconde nesta visita
    }
    setDismissed(true);
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestPush();
      if (sent > 0) toast.success("Notificação de teste enviada");
      else toast.error("Nenhum aparelho recebeu — toque em Ativar de novo.");
    } catch (err) {
      toast.error("Não deu pra enviar o teste", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;
  if (!isPage && (status === "on" || dismissed)) return null;

  const mobile = platform !== "desktop";
  // iPhone só recebe notificação com o Shoppfy instalado na tela inicial.
  const needsInstall = platform === "ios" ? !standalone : false;
  const showSteps = !standalone && !isPage; // na página o passo a passo é maior e fica fora
  const canEnableHere = status === "off" && !needsInstall;

  return (
    <div className="surface-card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-brand/10 blur-3xl" />
      {!isPage && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          aria-label="Fechar"
          title="Agora não"
        >
          <X className="size-4" />
        </button>
      )}

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 pr-8">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            {status === "denied" ? (
              <BellOff className="size-5" />
            ) : (
              <Smartphone className="size-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-foreground">
              {status === "on"
                ? "Notificações ativas neste aparelho"
                : "Receba as novidades do catálogo no celular"}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Produto novo, preço que baixou, reajuste de preço, produto que esgotou ou voltou ao
              estoque — chega na hora como notificação, igual um app.
            </p>
            {status === "denied" && (
              <p className="text-[12.5px] text-destructive">
                As notificações foram bloqueadas neste aparelho. iPhone: Ajustes → Notificações →
                Shoppfy → Permitir. Android: segure o ícone do Shoppfy → Informações do app →
                Notificações → Permitir. Depois abra o Shoppfy de novo.
              </p>
            )}
            {status === "unsupported" && platform === "ios" && !standalone && (
              <p className="text-[12.5px] text-muted-foreground">
                No iPhone, primeiro adicione o Shoppfy à tela inicial (passo a passo abaixo).
              </p>
            )}
            {status === "unsupported" && !(platform === "ios" && !standalone) && (
              <p className="text-[12.5px] text-muted-foreground">
                Este navegador não aceita notificações. Use o Safari no iPhone ou o Chrome no
                Android.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:pt-1">
          {platform === "android" && canInstall && !standalone && (
            <Button variant="outline" onClick={() => void handleInstall()} className="gap-2">
              <Download className="size-4" />
              Instalar app
            </Button>
          )}
          {status === "on" && (
            <Button
              variant="outline"
              onClick={() => void handleTest()}
              disabled={busy}
              className="gap-2"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
              Enviar teste
            </Button>
          )}
          {canEnableHere && (
            <Button onClick={() => void handleEnable()} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Ativar notificações
            </Button>
          )}
        </div>
      </div>

      {showSteps && (
        <div className="relative mt-4 rounded-lg border border-border bg-surface-hover/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-medium text-foreground">
              {mobile
                ? "Coloque o Shoppfy na tela inicial do celular:"
                : "No celular, coloque o Shoppfy na tela inicial:"}
            </p>
            <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5">
              {(["ios", "android"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    tab === t
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "ios" ? "iPhone" : "Android"}
                </button>
              ))}
            </div>
          </div>
          {tab === "ios" ? <IosSteps /> : <AndroidSteps />}
          <Link
            to="/aplicativo"
            className="mt-3 inline-block text-[12px] font-medium text-brand underline underline-offset-2"
          >
            Ver o passo a passo completo
          </Link>
        </div>
      )}

      {standalone && status === "off" && (
        <p className="relative mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <BellRing className="size-3.5" />
          Toque em “Ativar notificações” e depois em{" "}
          <span className="text-foreground">Permitir</span>.
        </p>
      )}
    </div>
  );
}
