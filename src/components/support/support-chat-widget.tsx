// Atendente virtual do Shoppfy — canal "chat interno" do motor de
// atendimento (support-bot.server.ts / support-bot.functions.ts). Fica
// disponível pra qualquer usuário logado, flutuando por cima de qualquer
// tela do app (montado uma vez em AppShell).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import {
  Image as ImageIcon,
  Loader2,
  Mic,
  MessageCircle,
  Send,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth-store";
import { useT } from "@/i18n/translations";
import {
  getMediaSignedUrl,
  listConversationMessages,
  listMyConversations,
  type SupportMessage,
} from "@/lib/support";
import { sendSupportMessage } from "@/lib/support-bot.functions";

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

export function SupportChatWidget() {
  const t = useT();
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);

  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([WELCOME]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [recording, setRecording] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const canUse = initialized && Boolean(session);
  const runSendSupportMessage = useServerFn(sendSupportMessage);

  // Carrega a conversa mais recente (se existir) só na primeira vez que abre.
  useEffect(() => {
    if (!open || loaded || !canUse) return;
    setLoaded(true);
    (async () => {
      try {
        const conversations = await listMyConversations();
        const latest = conversations[0];
        if (!latest) return;
        setConversationId(latest.id);
        setEscalated(latest.status === "escalated");
        const rows = await listConversationMessages(latest.id);
        const withMedia = await Promise.all(
          rows.map(async (m: SupportMessage) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            kind: m.kind as "text" | "image" | "audio",
            content: m.content,
            mediaUrl: m.media_path ? await getMediaSignedUrl(m.media_path) : null,
          })),
        );
        if (withMedia.length > 0) setMessages(withMedia);
      } catch (err) {
        console.error("[support] falha ao carregar conversa anterior:", err);
      }
    })();
  }, [open, loaded, canUse]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
      setConversationId(result.conversationId);
      setEscalated(result.escalated);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", kind: "text", content: result.reply },
      ]);
    } catch (err) {
      console.error("[support] falha ao enviar mensagem:", err);
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
      console.error("[support] microfone indisponível:", err);
      toast.error("Não consegui acessar o microfone", {
        description: "Verifique a permissão do navegador e tente de novo.",
      });
    }
  }

  if (!canUse) return null;

  return (
    <>
      <motion.button
        type="button"
        aria-label={open ? "Fechar atendimento" : "Abrir atendimento"}
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-50 grid size-12 place-items-center rounded-full border border-border bg-brand text-brand-foreground shadow-lg shadow-black/30 transition-colors hover:opacity-90"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">
                  {t("Atendimento Shoppfy")}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {escalated
                    ? t("Encaminhado pro time — alguém vai continuar por aqui")
                    : t("Resposta automática, em poucos segundos")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-hover text-muted-foreground">
                    {m.role === "user" ? (
                      <UserRound className="size-3.5" />
                    ) : (
                      <MessageCircle className="size-3.5" />
                    )}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-brand text-brand-foreground"
                        : "bg-surface-hover text-foreground"
                    }`}
                  >
                    {m.kind === "image" && m.mediaUrl && (
                      <img
                        src={m.mediaUrl}
                        alt="Imagem enviada"
                        className="mb-1.5 max-h-40 rounded-md object-cover"
                      />
                    )}
                    {m.kind === "audio" && m.mediaUrl && (
                      <audio
                        controls
                        src={m.mediaUrl}
                        className="mb-1.5 h-8 w-full max-w-[220px]"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  digitando…
                </div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
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
                  className="size-8 shrink-0"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                  title="Enviar print/foto"
                >
                  <ImageIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={recording ? "destructive" : "ghost"}
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={sending}
                  onClick={() => void toggleRecording()}
                  title={recording ? "Parar gravação" : "Gravar áudio"}
                >
                  {recording ? <Square className="size-3.5" /> : <Mic className="size-4" />}
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
                  placeholder={t("Digite sua mensagem…")}
                  className="max-h-24 min-h-9 flex-1 resize-none text-[12.5px]"
                  disabled={sending || recording}
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={sending || !text.trim()}
                  onClick={handleSendText}
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
