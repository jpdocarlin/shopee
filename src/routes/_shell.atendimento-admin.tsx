import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsOwner } from "@/lib/owner";
import { useAuthStore } from "@/stores/auth-store";
import {
  CATEGORY_LABEL,
  KNOWLEDGE_CATEGORIES,
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getMediaSignedUrl,
  getSupportStats,
  listAllConversations,
  listConversationMessages,
  listEscalations,
  listKnowledgeBase,
  listUnansweredQuestions,
  markUnansweredReviewed,
  updateEscalationStatus,
  updateKnowledgeEntry,
  type SupportConversation,
  type SupportEscalation,
  type SupportKnowledgeEntry,
  type SupportMessage,
  type SupportStats,
  type SupportUnansweredQuestion,
} from "@/lib/support";

const DESCRIPTION =
  "Conversas, escalonamentos, perguntas sem resposta e a base de conhecimento do atendimento automático.";

export const Route = createFileRoute("/_shell/atendimento-admin")({
  head: () => ({
    meta: [
      { title: "Atendimento (Admin) · Shoppfy" },
      { name: "description", content: DESCRIPTION },
    ],
  }),
  component: AtendimentoAdminPage,
});

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AtendimentoAdminPage() {
  const initialized = useAuthStore((s) => s.initialized);
  const isOwner = useIsOwner();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized && !isOwner) void navigate({ to: "/" });
  }, [initialized, isOwner, navigate]);

  if (!initialized || !isOwner) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return <AtendimentoAdminContent />;
}

function AtendimentoAdminContent() {
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshStats() {
    try {
      setStats(await getSupportStats());
    } catch (err) {
      console.error("[atendimento-admin] falha ao carregar métricas:", err);
    }
  }

  useEffect(() => {
    refreshStats().finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-7">
      <PageHeader title="Atendimento (Admin)" description={DESCRIPTION} />

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        stats && <StatsRow stats={stats} />
      )}

      <Tabs defaultValue="conversas">
        <TabsList>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
          <TabsTrigger value="escalonamentos">
            Escalonamentos
            {stats && stats.pendingEscalations > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">
                {stats.pendingEscalations}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="perguntas">
            Perguntas sem resposta
            {stats && stats.unreviewedUnanswered > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                {stats.unreviewedUnanswered}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="base">Base de conhecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-5">
          <ConversationsPanel />
        </TabsContent>
        <TabsContent value="escalonamentos" className="mt-5">
          <EscalationsPanel onChanged={refreshStats} />
        </TabsContent>
        <TabsContent value="perguntas" className="mt-5">
          <UnansweredPanel onChanged={refreshStats} />
        </TabsContent>
        <TabsContent value="base" className="mt-5">
          <KnowledgeBasePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatsRow({ stats }: { stats: SupportStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Conversas" value={String(stats.totalConversations)} />
      <StatCard label="Abertas" value={String(stats.openConversations)} />
      <StatCard label="Escaladas" value={String(stats.escalatedConversations)} />
      <StatCard label="Taxa de resolução" value={`${Math.round(stats.resolutionRate * 100)}%`} />
      <StatCard label="Sem resposta" value={String(stats.unreviewedUnanswered)} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Conversas
// --------------------------------------------------------------------------

function ConversationsPanel() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  useEffect(() => {
    listAllConversations()
      .then(setConversations)
      .catch((err) => console.error("[atendimento-admin] falha ao listar conversas:", err))
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      const rows = await listConversationMessages(id);
      setMessages(rows);
      const urls: Record<string, string | null> = {};
      await Promise.all(
        rows
          .filter((m) => m.media_path)
          .map(async (m) => {
            urls[m.id] = await getMediaSignedUrl(m.media_path as string);
          }),
      );
      setMediaUrls(urls);
    } catch (err) {
      console.error("[atendimento-admin] falha ao carregar mensagens:", err);
    } finally {
      setLoadingThread(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nenhuma conversa ainda"
        description="Assim que alguém falar com o atendimento, as conversas aparecem aqui."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="surface-card max-h-[560px] divide-y divide-border overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => void openConversation(c.id)}
            className={`block w-full px-3.5 py-3 text-left transition-colors hover:bg-surface-hover ${
              selectedId === c.id ? "bg-surface-hover" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12.5px] font-medium text-foreground">
                {c.title || "Conversa sem título"}
              </p>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDateTime(c.last_message_at)}
            </p>
          </button>
        ))}
      </div>

      <div className="surface-card min-h-[300px] max-h-[560px] overflow-y-auto p-4">
        {!selectedId ? (
          <p className="py-10 text-center text-[12.5px] text-muted-foreground">
            Selecione uma conversa pra ver as mensagens.
          </p>
        ) : loadingThread ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "" : "opacity-90"}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {m.role === "user" ? "Cliente" : "Atendimento"}
                  </span>
                  {m.intent && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {CATEGORY_LABEL[m.intent] ?? m.intent}
                    </Badge>
                  )}
                  <span className="text-[10.5px] text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </span>
                </div>
                <div className="mt-1 rounded-lg border border-border bg-surface-hover px-3 py-2 text-[12.5px] text-foreground">
                  {m.kind === "image" && mediaUrls[m.id] && (
                    <img
                      src={mediaUrls[m.id] as string}
                      alt="Imagem enviada"
                      className="mb-1.5 max-h-48 rounded-md object-cover"
                    />
                  )}
                  {m.kind === "audio" && mediaUrls[m.id] && (
                    <audio
                      controls
                      src={mediaUrls[m.id] as string}
                      className="mb-1.5 h-8 w-full max-w-[260px]"
                    />
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    open: { label: "Aberta", variant: "secondary" },
    resolved: { label: "Resolvida", variant: "default" },
    escalated: { label: "Escalada", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={cfg.variant} className="shrink-0 px-1.5 py-0 text-[10px]">
      {cfg.label}
    </Badge>
  );
}

// --------------------------------------------------------------------------
// Escalonamentos
// --------------------------------------------------------------------------

function EscalationsPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<SupportEscalation[]>([]);
  const [filter, setFilter] = useState<"pending" | "in_review" | "resolved">("pending");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await listEscalations(filter));
    } catch (err) {
      console.error("[atendimento-admin] falha ao listar escalonamentos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function updateStatus(id: string, status: SupportEscalation["status"]) {
    try {
      await updateEscalationStatus(id, status);
      toast.success("Atualizado");
      void load();
      onChanged();
    } catch {
      toast.error("Não foi possível atualizar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "in_review", "resolved"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "pending" ? "Pendentes" : s === "in_review" ? "Em análise" : "Resolvidos"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nada por aqui"
          description="Quando o atendimento encaminhar um caso pra humano, ele aparece nesta lista."
        />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div key={e.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-foreground">{e.reason}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{e.summary}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {e.status !== "in_review" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateStatus(e.id, "in_review")}
                    >
                      Analisar
                    </Button>
                  )}
                  {e.status !== "resolved" && (
                    <Button size="sm" onClick={() => void updateStatus(e.id, "resolved")}>
                      <CheckCircle2 className="size-3.5" />
                      Resolver
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Perguntas sem resposta
// --------------------------------------------------------------------------

function UnansweredPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<SupportUnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<SupportUnansweredQuestion | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await listUnansweredQuestions(true));
    } catch (err) {
      console.error("[atendimento-admin] falha ao listar perguntas sem resposta:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function dismiss(id: string) {
    try {
      await markUnansweredReviewed(id);
      void load();
      onChanged();
    } catch {
      toast.error("Não foi possível atualizar");
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="Nada pendente"
          description="Perguntas que o atendimento não soube responder aparecem aqui pra virarem conhecimento novo."
        />
      ) : (
        items.map((q) => (
          <div key={q.id} className="surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-foreground">{q.question}</p>
                {q.context && <p className="mt-1 text-[12px] text-muted-foreground">{q.context}</p>}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {q.category && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {CATEGORY_LABEL[q.category] ?? q.category}
                    </Badge>
                  )}
                  {formatDateTime(q.created_at)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setPromoting(q)}>
                  <Plus className="size-3.5" />
                  Adicionar à base
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void dismiss(q.id)}>
                  Dispensar
                </Button>
              </div>
            </div>
          </div>
        ))
      )}

      {promoting && (
        <KnowledgeEntryModal
          open
          initial={{
            category: promoting.category ?? "geral",
            question: promoting.question,
            answer: "",
            keywords: "",
          }}
          onClose={() => setPromoting(null)}
          onSaved={async () => {
            await dismiss(promoting.id);
            setPromoting(null);
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Base de conhecimento
// --------------------------------------------------------------------------

function KnowledgeBasePanel() {
  const [items, setItems] = useState<SupportKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupportKnowledgeEntry | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await listKnowledgeBase());
    } catch (err) {
      console.error("[atendimento-admin] falha ao listar base de conhecimento:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Remover este item da base de conhecimento?")) return;
    try {
      await deleteKnowledgeEntry(id);
      void load();
    } catch {
      toast.error("Não foi possível remover");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Novo fato
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Base vazia"
          description="Adicione o primeiro fato que o atendimento pode usar pra responder."
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((k) => (
            <div key={k.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {CATEGORY_LABEL[k.category] ?? k.category}
                    </Badge>
                    {!k.is_active && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-medium text-foreground">{k.question}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{k.answer}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(k);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void remove(k.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <KnowledgeEntryModal
          open
          entry={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function KnowledgeEntryModal({
  open,
  entry,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  entry?: SupportKnowledgeEntry | null;
  initial?: { category: string; question: string; answer: string; keywords: string };
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [category, setCategory] = useState(entry?.category ?? initial?.category ?? "geral");
  const [question, setQuestion] = useState(entry?.question ?? initial?.question ?? "");
  const [answer, setAnswer] = useState(entry?.answer ?? initial?.answer ?? "");
  const [keywords, setKeywords] = useState(entry?.keywords?.join(", ") ?? initial?.keywords ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!question.trim() || !answer.trim()) {
      toast.error("Preencha a pergunta e a resposta");
      return;
    }
    setSaving(true);
    const keywordList = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    try {
      if (entry) {
        await updateKnowledgeEntry(entry.id, {
          category,
          question: question.trim(),
          answer: answer.trim(),
          keywords: keywordList,
        });
      } else {
        await createKnowledgeEntry({
          category,
          question: question.trim(),
          answer: answer.trim(),
          keywords: keywordList,
        });
      }
      toast.success("Salvo");
      await onSaved();
    } catch (err) {
      console.error("[atendimento-admin] falha ao salvar fato:", err);
      toast.error("Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={entry ? "Editar fato" : "Novo fato"}
      description="Isso é o que o atendimento pode citar pra responder — nada além disso."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c] ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Pergunta de referência</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Como funciona o Criar Anúncio?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Resposta (o fato em si)</Label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Escreva só o que é verdade e confirmado."
            className="min-h-24"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Palavras-chave (separadas por vírgula)</Label>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex: anúncio, publicar, shopee"
          />
        </div>
      </div>
    </Modal>
  );
}
