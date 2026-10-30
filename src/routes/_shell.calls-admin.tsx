import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, Phone, Save, Video } from "lucide-react";
import { toast } from "sonner";

import { AceleradorAdmin } from "@/components/addons/acelerador-admin";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListCalls,
  adminSetCallRoom,
  adminSetCallStatus,
  type CallBooking,
} from "@/lib/addons.functions";
import { useIsPedidosAdmin, useRolesReady } from "@/lib/owner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/calls-admin")({
  head: () => ({ meta: [{ title: "Calls (Admin) · Shoppfy" }] }),
  component: CallsAdminPage,
});

const STATUS: Record<CallBooking["status"], { label: string; cls: string }> = {
  scheduled: { label: "Marcada", cls: "bg-warning/15 text-warning" },
  done: { label: "Feita", cls: "bg-success/15 text-success" },
  no_show: { label: "Não veio", cls: "bg-destructive/15 text-destructive" },
  canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function CallsAdminPage() {
  const ready = useRolesReady();
  const isAdminAccount = useIsPedidosAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<{ roomUrl: string | null; calls: CallBooking[] } | null>(null);
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"calls" | "acelerador">("calls");

  useEffect(() => {
    if (ready && !isAdminAccount) void navigate({ to: "/" });
  }, [ready, isAdminAccount, navigate]);

  const load = async () => {
    try {
      const d = await adminListCalls();
      setData(d);
      setRoom(d.roomUrl ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra carregar.");
    }
  };
  useEffect(() => {
    if (ready && isAdminAccount) void load();
  }, [ready, isAdminAccount]);

  // Agrupa por sala (horário).
  const slots = useMemo(() => {
    const map = new Map<string, CallBooking[]>();
    for (const c of data?.calls ?? []) {
      const list = map.get(c.slotAt) ?? [];
      list.push(c);
      map.set(c.slotAt, list);
    }
    return [...map.entries()];
  }, [data]);

  const saveRoom = async () => {
    setBusy("room");
    try {
      await adminSetCallRoom({ data: { url: room } });
      toast.success("Link da sala salvo — vai nos próximos e-mails");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra salvar.");
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (id: string, status: CallBooking["status"]) => {
    setBusy(id);
    try {
      await adminSetCallStatus({ data: { id, status } });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calls (Admin)"
        description={
          tab === "calls"
            ? "Calls de implementação compradas. Cada pessoa entra na próxima sala (hora cheia, 9h–21h), pelo menos 30 min depois de pagar."
            : "Alunos do Acelerador (30 dias). A cada 5 pessoas abre uma turma nova, com o seu grupo de WhatsApp."
        }
      />

      <div className="inline-flex rounded-lg border border-border bg-surface-hover/40 p-1">
        {(
          [
            ["calls", "Calls de implementação"],
            ["acelerador", "Acelerador"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              tab === key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "acelerador" ? (
        <AceleradorAdmin />
      ) : (
        <>
          <div className="surface-card space-y-2 p-5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Video className="size-4 text-brand" /> Link fixo da sala (Google Meet, Zoom…)
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="https://meet.google.com/…"
                className="h-9 max-w-md text-[13px]"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={busy === "room"}
                onClick={() => void saveRoom()}
              >
                {busy === "room" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Salvar
              </Button>
            </div>
            {!data?.roomUrl && (
              <p className="text-[12px] text-warning">
                Sem link salvo: o e-mail da call sai sem o botão da sala. Cole o link e salve.
              </p>
            )}
          </div>

          {!data ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <p className="surface-card px-4 py-10 text-center text-[13px] text-muted-foreground">
              Nenhuma call marcada ainda.
            </p>
          ) : (
            slots.map(([slot, calls]) => (
              <div key={slot} className="surface-card overflow-hidden">
                <p className="border-b border-border px-5 py-3 text-[14px] font-semibold text-foreground">
                  Sala de {fmt(slot)} · {calls.length} pessoa(s)
                </p>
                <div className="divide-y divide-border">
                  {calls.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 text-[12.5px]">
                        <p className="font-medium text-foreground">
                          {c.name ?? "Sem nome"}{" "}
                          <span
                            className={cn(
                              "ml-1 rounded-full px-2 py-0.5 text-[11px]",
                              STATUS[c.status].cls,
                            )}
                          >
                            {STATUS[c.status].label}
                          </span>
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                          {c.email}
                          <button
                            type="button"
                            aria-label="Copiar e-mail"
                            onClick={() => {
                              void navigator.clipboard.writeText(c.email);
                              toast.success("Copiado");
                            }}
                          >
                            <Copy className="size-3" />
                          </button>
                          {c.phone && (
                            <a
                              href={`https://wa.me/55${c.phone.replace(/\D/g, "").replace(/^55/, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-brand"
                            >
                              <Phone className="size-3" /> {c.phone}
                            </a>
                          )}
                          · pagou {fmt(c.paidAt)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {(["done", "no_show", "scheduled"] as const).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={c.status === s ? "default" : "outline"}
                            className="h-7 gap-1 text-[11.5px]"
                            disabled={busy === c.id || c.status === s}
                            onClick={() => void setStatus(c.id, s)}
                          >
                            {s === "done" && <Check className="size-3" />}
                            {STATUS[s].label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
