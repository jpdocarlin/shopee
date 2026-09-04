import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PIX_KEYS, buildPixPayload, type PixKeyConfig } from "@/lib/pix";
import { formatBRL } from "@/lib/format";

// Fica só no formulário de Pedidos, onde o revendedor precisa pagar. O
// payload do Pix é gerado inteiramente no navegador (ver lib/pix.ts) — não
// chama nenhum serviço externo, então a chave e o valor nunca saem daqui.
// De propósito, a chave nunca aparece como texto puro na tela: só o QR code
// e o botão de copiar o código.
export function PixPayment({ amountCents }: { amountCents: number }) {
  const [activeKeyId, setActiveKeyId] = useState<PixKeyConfig["id"]>("principal");

  const activeKey = PIX_KEYS.find((k) => k.id === activeKeyId) ?? PIX_KEYS[0];
  const reservaKey = PIX_KEYS.find((k) => k.id === "reserva");

  const payload = useMemo(() => buildPixPayload(activeKey, amountCents), [activeKey, amountCents]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Código Pix copiado", { description: "Cole no seu banco para pagar." });
    } catch {
      toast.error("Não deu pra copiar o código agora");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-hover/40 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <QrCode className="size-3.5 text-brand" />
        <p className="text-[12.5px] font-medium text-foreground">Pagar com Pix</p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-lg border border-border bg-card p-2.5">
          <QRCodeSVG value={payload} size={148} level="M" />
        </div>
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <p className="text-[13px] text-muted-foreground">
            Escaneie o QR code ou copie o código Pix. Valor:{" "}
            <span className="font-semibold text-foreground">{formatBRL(amountCents)}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[12px]"
            onClick={copyCode}
          >
            <Copy className="size-3.5" />
            Copiar código Pix
          </Button>

          {activeKeyId === "principal" && reservaKey && (
            <button
              type="button"
              onClick={() => setActiveKeyId("reserva")}
              className="block text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Não consegui pagar com essa chave
            </button>
          )}
          {activeKeyId === "reserva" && reservaKey && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveKeyId("principal")}
                className="block text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Voltar pra chave principal
              </button>
              {reservaKey.note && (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                  {reservaKey.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
