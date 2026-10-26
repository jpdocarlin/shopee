// Server-only: IA gratuita (Groq — https://console.groq.com, plano free sem
// cartão). Usada no lugar do Gemini pra texto (atendimento, anúncio,
// histórias), transcrição de áudio e leitura de print.
//
// 26/10/2026: o Jp pediu pra trocar o Gemini (cobrado por uso) por uma IA
// gratuita. Quando GROQ_API_KEY existe, tudo passa primeiro pelo Groq. Se o
// Groq falhar (limite diário do plano grátis, instabilidade) E ainda existir
// GEMINI_API_KEY, quem chama cai no Gemini só naquela chamada. Pra nunca
// gastar crédito do Google, é só apagar a GEMINI_API_KEY da Vercel.
//
// Os nomes dos modelos mudam com frequência no Groq, então o modelo é
// escolhido na hora a partir da lista que a própria conta tem liberada
// (GET /models), seguindo uma ordem de preferência. Dá pra forçar um modelo
// pelas variáveis GROQ_TEXT_MODEL / GROQ_VISION_MODEL / GROQ_AUDIO_MODEL.
const BASE = "https://api.groq.com/openai/v1";

const TEXT_PREFERENCE = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];
const VISION_PREFERENCE = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];
const AUDIO_PREFERENCE = ["whisper-large-v3-turbo", "whisper-large-v3"];

export function hasGroq(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY não configurada.");
  return k;
}

let modelCache: { ids: string[]; at: number } | null = null;

async function availableModels(): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < 60 * 60 * 1000) return modelCache.ids;
  try {
    const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key()}` } });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id: string; active?: boolean }> };
      const ids = (json.data ?? []).filter((m) => m.active !== false).map((m) => m.id);
      modelCache = { ids, at: Date.now() };
      return ids;
    }
    console.error(`[Groq] /models ${res.status}`);
  } catch (err) {
    console.error("[Groq] falha ao listar modelos:", err);
  }
  return [];
}

async function pickModel(
  envName: string,
  preference: string[],
  fallbackMatch: RegExp,
): Promise<string> {
  const forced = process.env[envName];
  if (forced) return forced;
  const ids = await availableModels();
  if (ids.length === 0) return preference[0];
  const preferred = preference.find((p) => ids.includes(p));
  if (preferred) return preferred;
  return ids.find((id) => fallbackMatch.test(id)) ?? preference[0];
}

// Alguns modelos (Qwen, DeepSeek) devolvem o raciocínio entre <think>…</think>.
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export type GroqResult = { text: string; finish: "STOP" | "MAX_TOKENS" | "OTHER" };

type ChatContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function chat(
  model: string,
  content: ChatContent,
  opts: { maxTokens: number; json?: boolean },
): Promise<GroqResult> {
  const send = async (json: boolean) =>
    fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        // Folga pro raciocínio interno dos modelos "thinking".
        max_completion_tokens: Math.max(opts.maxTokens * 2, 1024),
        temperature: 0.6,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res = await send(Boolean(opts.json));
    // Modelo sem modo JSON: tenta de novo sem ele (o prompt já pede JSON).
    if (res.status === 400 && opts.json) res = await send(false);
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      };
      const choice = json.choices?.[0];
      const text = stripThinking(choice?.message?.content ?? "");
      const finish =
        choice?.finish_reason === "stop"
          ? "STOP"
          : choice?.finish_reason === "length"
            ? "MAX_TOKENS"
            : "OTHER";
      return { text, finish };
    }
    const errText = await res.text();
    // 429 = limite por minuto/dia do plano grátis; 5xx = instabilidade.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1500));
      continue;
    }
    throw new Error(`[Groq] ${res.status} ${errText.slice(0, 300)}`);
  }
  throw new Error("[Groq] falha inesperada.");
}

export async function groqText(
  prompt: string,
  opts: { maxTokens: number; json?: boolean },
): Promise<GroqResult> {
  const model = await pickModel(
    "GROQ_TEXT_MODEL",
    TEXT_PREFERENCE,
    /gpt-oss|llama|qwen|kimi|deepseek/i,
  );
  return chat(model, prompt, opts);
}

export async function groqVision(
  prompt: string,
  base64: string,
  mimeType: string,
  opts: { maxTokens: number },
): Promise<GroqResult> {
  const model = await pickModel(
    "GROQ_VISION_MODEL",
    VISION_PREFERENCE,
    /vision|scout|maverick|-vl|qwen3\.\d+-\d+b/i,
  );
  return chat(
    model,
    [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
    ],
    opts,
  );
}

export async function groqTranscribe(base64: string, mimeType: string): Promise<string> {
  const model = await pickModel("GROQ_AUDIO_MODEL", AUDIO_PREFERENCE, /whisper/i);
  const ext =
    mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mpeg") || mimeType.includes("mp3")
          ? "mp3"
          : mimeType.includes("wav")
            ? "wav"
            : "webm";
  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(base64, "base64")], { type: mimeType }),
    `audio.${ext}`,
  );
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`[Groq áudio] ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
