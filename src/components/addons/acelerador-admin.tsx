import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, Phone, Save, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListAcelerador,
  adminSetAceleradorGroupLink,
  adminSetAceleradorRemoved,
  type AceleradorGroup,
  type AceleradorMember,
} from "@/lib/addons.functions";
import { cn } from "@/lib/utils";

const GROUP_SIZE = 5;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });

function MemberRow({
  m,
  busy,
  onRemoved,
}: {
  m: AceleradorMember;
  busy: boolean;
  onRemoved: (removed: boolean) => void;
}) {
  const expired = m.daysLeft <= 0 || m.status === "refunded";
  const mustRemove = expired && !m.removed;
  const phoneDigits = m.phone?.replace(/\D/g, "").replace(/^55/, "");
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-5 py-3",
        mustRemove && "bg-destructive/5",
        m.removed && "opacity-55",
      )}
    >
      <div className="min-w-0 text-[12.5px]">
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
          {m.name ?? "Sem nome"}
          {m.status === "refunded" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Reembolsou
            </span>
          ) : m.daysLeft > 0 ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                m.daysLeft <= 3 ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
              )}
            >
              {m.daysLeft} {m.daysLeft === 1 ? "dia" : "dias"}
            </span>
          ) : (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
              Venceu
            </span>
          )}
          {mustRemove && (
            <span className="text-[11px] font-semibold text-destructive">Remover do grupo</span>
          )}
          {m.removed && (
            <span className="text-[11px] text-muted-foreground">Removido do grupo</span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {m.email}
          <button
            type="button"
            aria-label="Copiar e-mail"
            onClick={() => {
              void navigator.clipboard.writeText(m.email);
              toast.success("Copiado");
            }}
          >
            <Copy className="size-3" />
          </button>
          {phoneDigits && (
            <a
              href={`https://wa.me/55${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand"
            >
              <Phone className="size-3" /> {m.phone}
            </a>
          )}
          · entrou {day(m.joinedAt)} · vence {day(m.expiresAt)}
          {!m.linkSent && m.status === "active" && " · ainda sem link do grupo"}
        </p>
      </div>
      {(expired || m.removed) && (
        <Button
          size="sm"
          variant={m.removed ? "outline" : "default"}
          className="h-7 gap-1 text-[11.5px]"
          disabled={busy}
          onClick={() => onRemoved(!m.removed)}
        >
          <UserMinus className="size-3" />
          {m.removed ? "Desfazer" : "Já removi"}
        </Button>
      )}
    </div>
  );
}

function GroupCard({ g, reload }: { g: AceleradorGroup; reload: () => Promise<void> }) {
  const [url, setUrl] = useState(g.whatsappUrl ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setUrl(g.whatsappUrl ?? ""), [g.whatsappUrl]);

  const active = g.members.filter((m) => m.status === "active" && m.daysLeft > 0).length;
  const toRemove = g.members.filter(
    (m) => (m.daysLeft <= 0 || m.status === "refunded") && !m.removed,
  ).length;
  const full = g.members.length >= GROUP_SIZE;

  const saveLink = async () => {
    setBusy("link");
    try {
      const r = await adminSetAceleradorGroupLink({ data: { groupId: g.id, url } });
      toast.success(r.sent ? `Link salvo e enviado pra ${r.sent} pessoa(s)` : "Link salvo");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra salvar.");
    } finally {
      setBusy(null);
    }
  };

  const setRemoved = async (id: string, removed: boolean) => {
    setBusy(id);
    try {
      await adminSetAceleradorRemoved({ data: { id, removed } });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <Users className="size-4 text-brand" /> Turma {g.number}
          <span className="text-[12px] font-normal text-muted-foreground">
            {g.members.length}/{GROUP_SIZE} {full ? "· completa" : "· aberta"} · {active} ativo(s)
          </span>
        </p>
        {toRemove > 0 && (
          <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11.5px] font-medium text-destructive">
            {toRemove} pra remover do grupo
          </span>
        )}
      </div>
      <div className="space-y-1.5 border-b border-border px-5 py-3">
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Link2 className="size-3.5" /> Link de convite do grupo do WhatsApp
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/…"
            className="h-9 max-w-md text-[13px]"
          />
          <Button
            size="sm"
            className="h-9 gap-1.5"
            disabled={busy === "link" || !url.trim() || url.trim() === (g.whatsappUrl ?? "")}
            onClick={() => void saveLink()}
          >
            {busy === "link" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Salvar e enviar
          </Button>
        </div>
        {!g.whatsappUrl && (
          <p className="text-[12px] text-warning">
            Crie o grupo da Turma {g.number} e cole o link — quem já entrou recebe por e-mail na
            hora.
          </p>
        )}
      </div>
      <div className="divide-y divide-border">
        {g.members.map((m) => (
          <MemberRow
            key={m.id}
            m={m}
            busy={busy === m.id}
            onRemoved={(removed) => void setRemoved(m.id, removed)}
          />
        ))}
      </div>
    </div>
  );
}

export function AceleradorAdmin() {
  const [groups, setGroups] = useState<AceleradorGroup[] | null>(null);

  const load = async () => {
    try {
      setGroups(await adminListAcelerador());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu pra carregar.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  if (!groups) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="surface-card px-4 py-10 text-center text-[13px] text-muted-foreground">
        Ninguém no Acelerador ainda. A cada 5 alunos o sistema abre uma turma nova e te avisa pra
        criar o grupo.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <GroupCard key={g.id} g={g} reload={load} />
      ))}
    </div>
  );
}
