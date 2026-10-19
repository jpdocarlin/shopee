import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPushPublicKey, savePushSubscription, sendTestPush } from "@/lib/push.functions";

type Status =
  | "checking"
  | "ios-install" // iPhone no Safari: precisa adicionar à tela inicial antes
  | "unsupported"
  | "denied"
  | "off"
  | "on";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
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

// Cartão no topo de Pedidos (Admin): liga a notificação de pedido novo neste
// aparelho. No iPhone só funciona com o Shoppfy adicionado à tela inicial
// (iOS 16.4+) — o cartão mostra o passo a passo quando ainda não está.
export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setStatus(isIos() && !isStandalone() ? "ios-install" : "unsupported");
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
    };
  }, []);

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
    } catch (err) {
      console.error("[push] falha ao ativar:", err);
      toast.error("Não deu pra ativar as notificações", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestPush();
      if (sent > 0) toast.success("Notificação de teste enviada");
      else toast.error("Nenhum aparelho recebeu — tente ativar de novo.");
    } catch (err) {
      toast.error("Não deu pra enviar o teste", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;

  return (
    <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
          {status === "on" ? (
            <BellRing className="size-5" />
          ) : status === "denied" ? (
            <BellOff className="size-5" />
          ) : (
            <Bell className="size-5" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-foreground">
            {status === "on"
              ? "Notificações ativas neste aparelho"
              : "Receber aviso de pedido novo no celular"}
          </p>

          {status === "on" && (
            <p className="text-[12.5px] text-muted-foreground">
              Cada pedido enviado por um revendedor chega aqui como notificação.
            </p>
          )}

          {status === "off" && (
            <p className="text-[12.5px] text-muted-foreground">
              Toque em “Ativar” e permita as notificações quando o aparelho perguntar.
            </p>
          )}

          {status === "denied" && (
            <p className="text-[12.5px] text-muted-foreground">
              As notificações foram bloqueadas. No iPhone: Ajustes → Notificações → Shoppfy →
              Permitir Notificações. Depois, abra o app de novo.
            </p>
          )}

          {status === "unsupported" && (
            <p className="text-[12.5px] text-muted-foreground">
              Este navegador não suporta notificações. No iPhone, abra o shoppfy.online no Safari.
            </p>
          )}

          {status === "ios-install" && (
            <ol className="space-y-1 text-[12.5px] text-muted-foreground">
              <li>
                1. No Safari, toque em{" "}
                <Share className="inline size-3.5 -translate-y-px text-foreground" />{" "}
                <span className="text-foreground">Compartilhar</span>.
              </li>
              <li>
                2. Toque em{" "}
                <SquarePlus className="inline size-3.5 -translate-y-px text-foreground" />{" "}
                <span className="text-foreground">Adicionar à Tela de Início</span>.
              </li>
              <li>3. Abra o Shoppfy pelo ícone novo, entre na conta e volte aqui pra ativar.</li>
            </ol>
          )}
        </div>
      </div>

      {status === "off" && (
        <Button onClick={() => void handleEnable()} disabled={busy} className="shrink-0 gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
          Ativar notificações
        </Button>
      )}
      {status === "on" && (
        <Button
          variant="outline"
          onClick={() => void handleTest()}
          disabled={busy}
          className="shrink-0 gap-2"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          Enviar teste
        </Button>
      )}
    </div>
  );
}
