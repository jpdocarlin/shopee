// Site dedicado do atendimento — "estilo ChatGPT", tela cheia, separado do
// dashboard principal (pensado pra rodar num subdomínio próprio,
// atendimento.shoppfy.online, ver vercel.json). Login próprio (mesma conta
// Supabase de sempre — não é uma base de usuário nova), sem nenhum dos
// gates de onboarding/marketplace do _shell: suporte não pode depender de
// o cliente já ter conectado loja ou terminado o cadastro.
//
// Reaproveita o mesmo motor (support-bot.server.ts via sendSupportMessage)
// e as mesmas leituras (support.ts) do widget flutuante — troca só a
// interface, não a lógica.
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Lock,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Send,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BrandWordmark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import {
  getMediaSignedUrl,
  listConversationMessages,
  listMyConversations,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support";
import { sendSupportMessage } from "@/lib/support-bot.functions";

export const Route = createFileRoute("/atendimento")({
  head: () => ({
    meta: [
      { title: "Atendimento · Shoppfy" },
      { name: "description", content: "Fale com o atendimento do Shoppfy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AtendimentoPage,
});

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AtendimentoPage() {
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);

  if (!initialized) return <FullScreenLoader />;
  if (!session) return <AtendimentoLogin />;
  return <AtendimentoChatApp />;
}

// ---------------------------------------------------------------------------
// Login próprio dessa "tela" — mesma conta Supabase do Shoppfy, só uma tela
// dedicada (sem o resto do dashboard) pra quem chega direto no atendimento.
// ---------------------------------------------------------------------------

function AtendimentoLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message,
      );
      setLoading(false);
      return;
    }
    // Sessão atualiza via useAuthStore (AuthProvider já está montado no
    // root) — este componente some sozinho quando `session` deixar de ser
    // null, não precisa navegar pra lugar nenhum.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandWordmark />
        </div>

        <div className="surface-card space-y-5 p-6">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-foreground">
              Atendimento Shoppfy
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Entre com sua conta Shoppfy pra falar com o atendimento.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="atendimento-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="atendimento-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="atendimento-password">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="atendimento-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-muted-foreground">
          É cliente Shoppfy? Use o mesmo e-mail e senha do painel principal.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App de chat em tela cheia — sidebar de conversas + thread, mesmo padrão
// visual do resto do Shoppfy (dark, cantos arredondados, laranja de marca).
// ---------------------------------------------------------------------------

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  kind: "text" | "image" | "audio";
  content: string;
  mediaUrl?: string | null;
};

const WELCOME: LocalMessage = {
  id: "welcome",
  role: "assistant",
  kind: "text",
  content:
    "Oi! Sou o atendimento do Shoppfy. Me conta o que você precisa — pode mandar texto, print ou áudio.",
};

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mimeType: file.type || "application/octet-stream" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function AtendimentoChatApp() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([WELCOME]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const runSendSupportMessage = useServerFn(sendSupportMessage);

  async function refreshConversations() {
    try {
      const rows = await listMyConversations();
      setConversations(rows);
      return rows;
    } catch (err) {
      console.error("[atendimento] falha ao listar conversas:", err);
      return [];
    } finally {
      setLoadingList(false);
    }
  }

  // Primeira carga: lista as conversas e abre a mais recente (se existir).
  useEffect(() => {
    (async () => {
      const rows = await refreshConversations();
      const latest = rows[0];
      if (latest) void openConversation(latest.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function openConversation(id: string) {
    setConversationId(id);
    setSidebarOpen(false);
    setLoadingThread(true);
    try {
      const rows = await listConversationMessages(id);
      const withMedia = await Promise.all(
        rows.map(async (m: SupportMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          kind: m.kind as "text" | "image" | "audio",
          content: m.content,
          mediaUrl: m.media_path ? await getMediaSignedUrl(m.media_path) : null,
        })),
      );
      setMessages(withMedia.length > 0 ? withMedia : [WELCOME]);
      const conv = conversations.find((c) => c.id === id);
      setEscalated(conv?.status === "escalated");
    } catch (err) {
      console.error("[atendimento] falha ao carregar conversa:", err);
    } finally {
      setLoadingThread(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([WELCOME]);
    setEscalated(false);
    setSidebarOpen(false);
  }

  async function send(
    kind: "text" | "image" | "audio",
    payload: { text?: string; base64?: string; mimeType?: string; localPreview?: string },
  ) {
    if (sending) return;
    setSending(true);

    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: "user",
        kind,
        content: payload.text || (kind === "image" ? "(imagem enviada)" : "(áudio enviado)"),
        mediaUrl: payload.localPreview,
      },
    ]);

    try {
      const result = await runSendSupportMessage({
        data: {
          conversationId,
          kind,
          text: payload.text,
          mediaBase64: payload.base64,
          mediaMimeType: payload.mimeType,
        },
      });
      const isNewConversation = !conversationId;
      setConversationId(result.conversationId);
      setEscalated(result.escalated);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", kind: "text", content: result.reply },
      ]);
      if (isNewConversation) void refreshConversations();
    } catch (err) {
      console.error("[atendimento] falha ao enviar mensagem:", err);
      const message = err instanceof Error ? err.message : "Não deu pra enviar sua mensagem agora.";
      toast.error("Atendimento indisponível", { description: message });
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: "Desculpa, não consegui responder agora. Tenta de novo em instantes.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    void send("text", { text: trimmed });
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { base64, mimeType } = await fileToBase64(file);
    void send("image", {
      text: text.trim() || undefined,
      base64,
      mimeType,
      localPreview: URL.createObjectURL(file),
    });
    setText("");
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType.split(";")[0] });
        const { base64, mimeType: cleanMime } = await fileToBase64(
          new File([blob], "audio.webm", { type: mimeType.split(";")[0] }),
        );
        void send("audio", {
          base64,
          mimeType: cleanMime,
          localPreview: URL.createObjectURL(blob),
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("[atendimento] microfone indisponível:", err);
      toast.error("Não consegui acessar o microfone", {
        description: "Verifique a permissão do navegador e tente de novo.",
      });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const activeConversation = conversations.find((c) => c.id === conversationId);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar — desktop sempre visível, mobile via overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-border bg-popover transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3.5">
          <BrandWordmark compact />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={startNewConversation}
          >
            <Plus className="size-4" />
            Nova conversa
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingList ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2.5 py-4 text-[12px] text-muted-foreground">
              Suas conversas anteriores aparecem aqui.
            </p>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void openConversation(c.id)}
                  className={`block w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover ${
                    conversationId === c.id ? "bg-surface-hover" : ""
                  }`}
                >
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    {c.title || "Conversa sem título"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {c.status === "escalated" && (
                      <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                    )}
                    {formatRelativeTime(c.last_message_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover md:hidden"
          >
            <Menu className="size-4.5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-foreground">
              {activeConversation?.title || "Atendimento Shoppfy"}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {escalated
                ? "Encaminhado pro time — alguém vai continuar por aqui"
                : "Resposta automática, em poucos segundos"}
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
            {loadingThread ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-hover text-muted-foreground">
                    {m.role === "user" ? (
                      <UserRound className="size-4" />
                    ) : (
                      <MessageCircle className="size-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-brand text-brand-foreground"
                        : "bg-surface-hover text-foreground"
                    }`}
                  >
                    {m.kind === "image" && m.mediaUrl && (
                      <img
                        src={m.mediaUrl}
                        alt="Imagem enviada"
                        className="mb-1.5 max-h-64 rounded-md object-cover"
                      />
                    )}
                    {m.kind === "audio" && m.mediaUrl && (
                      <audio controls src={m.mediaUrl} className="mb-1.5 h-8 w-full max-w-xs" />
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 pl-9 text-[11.5px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                digitando…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-3.5">
          <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickImage}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              title="Enviar print/foto"
            >
              <ImageIcon className="size-4.5" />
            </Button>
            <Button
              type="button"
              variant={recording ? "destructive" : "ghost"}
              size="icon"
              className="size-9 shrink-0"
              disabled={sending}
              onClick={() => void toggleRecording()}
              title={recording ? "Parar gravação" : "Gravar áudio"}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4.5" />}
            </Button>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder="Digite sua mensagem…"
              className="max-h-32 min-h-10 flex-1 resize-none text-[13px]"
              disabled={sending || recording}
            />
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0"
              disabled={sending || !text.trim()}
              onClick={handleSendText}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
