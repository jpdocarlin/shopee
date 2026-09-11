-- =========================================================
-- SUPPORT BOT · atendimento automatizado do Shoppfy
-- =========================================================
-- Motor de atendimento: conversas + mensagens (texto/imagem/áudio) + base
-- de conhecimento editável + escalonamento pra humano + fila de perguntas
-- sem resposta (pra virar conhecimento depois). Tudo isolado por usuário via
-- RLS, com o dono (role 'admin', já usada em todo o resto do app) enxergando
-- tudo pro painel administrativo.

-- ---------- support_conversations ----------
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'app' hoje (chat interno do Shoppfy) — motor separado do canal desde o
  -- início pra dar pra plugar WhatsApp/Telegram depois sem mexer na lógica.
  channel TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'whatsapp', 'telegram')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
  -- Resumo curto (primeira mensagem do cliente) só pra listar no painel admin.
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_conversations_user ON public.support_conversations(user_id, last_message_at DESC);
CREATE INDEX idx_support_conversations_status ON public.support_conversations(status, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_conversations_select_own" ON public.support_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "support_conversations_insert_own" ON public.support_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "support_conversations_update_own" ON public.support_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "support_conversations_admin_select_all" ON public.support_conversations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_conversations_admin_update_all" ON public.support_conversations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_support_conversations_updated
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- support_messages ----------
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  -- Denormalizado (mesmo user_id da conversa) só pra RLS ficar simples e
  -- direta nesta tabela, sem precisar de subquery em toda policy.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'audio')),
  -- Texto da mensagem — pra áudio é a transcrição, pra imagem é a legenda
  -- (se o cliente escreveu alguma) ou vazio.
  content TEXT NOT NULL DEFAULT '',
  -- Caminho no bucket privado support-media (imagem/áudio original enviado).
  media_path TEXT,
  -- Categoria identificada (só em mensagens role='user') — ver CHECK abaixo.
  intent TEXT CHECK (
    intent IS NULL OR intent IN (
      'duvida_geral', 'como_usar', 'produto', 'shopee', 'afiliados',
      'fornecedor', 'pedidos', 'criar_anuncio', 'ia', 'videos', 'pagamento',
      'plano', 'creditos_limites', 'login_acesso', 'erro_tecnico',
      'reclamacao', 'reembolso', 'pre_venda', 'atendimento_humano'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_messages_conversation ON public.support_messages(conversation_id, created_at);
CREATE INDEX idx_support_messages_user ON public.support_messages(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_select_own" ON public.support_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "support_messages_insert_own" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "support_messages_admin_select_all" ON public.support_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Wrapper IMMUTABLE em cima de to_tsvector('portuguese', ...) — a função
-- nativa é marcada STABLE (a configuração de busca poderia, em teoria,
-- mudar), e Postgres não aceita função STABLE numa coluna GENERATED. Esse
-- wrapper simples resolve (mesmo truque usado em qualquer coluna gerada de
-- full-text search no Postgres).
CREATE OR REPLACE FUNCTION public.support_kb_tsvector(question TEXT, answer TEXT, keywords TEXT[])
RETURNS TSVECTOR
LANGUAGE sql IMMUTABLE AS $$
  SELECT
    setweight(to_tsvector('portuguese', coalesce(question, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(answer, '')), 'B') ||
    setweight(to_tsvector('portuguese', array_to_string(coalesce(keywords, '{}'), ' ')), 'A');
$$;

-- ---------- support_knowledge_base ----------
-- Editável (pelo admin) sem tocar em código — cada linha é um fato real do
-- Shoppfy que o bot pode citar. NUNCA é gerado pela IA: só entra aqui o que
-- um humano confirmou.
CREATE TABLE public.support_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (
    category IN (
      'geral', 'como_usar', 'produto', 'shopee', 'afiliados', 'fornecedor',
      'pedidos', 'criar_anuncio', 'ia', 'videos', 'pagamento', 'plano',
      'creditos_limites', 'login_acesso', 'erro_tecnico', 'reembolso'
    )
  ),
  -- Pergunta de referência (pra listar/organizar no painel admin).
  question TEXT NOT NULL,
  -- Fato/resposta em si — é isso que entra no contexto do prompt da IA.
  answer TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Busca full-text (português) sobre pergunta+resposta+keywords — RAG leve
  -- sem precisar de embeddings/pgvector (mantém custo de IA baixo: a busca
  -- roda no Postgres, não gasta chamada de modelo nenhuma).
  search_vector TSVECTOR GENERATED ALWAYS AS (
    public.support_kb_tsvector(question, answer, keywords)
  ) STORED
);
CREATE INDEX idx_support_kb_search ON public.support_knowledge_base USING GIN (search_vector);
CREATE INDEX idx_support_kb_category ON public.support_knowledge_base(category) WHERE is_active;

GRANT SELECT ON public.support_knowledge_base TO authenticated;
GRANT ALL ON public.support_knowledge_base TO service_role;
ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário logado pode LER a base (o motor de busca roda com o
-- cliente autenticado do próprio usuário) — só o admin escreve.
CREATE POLICY "support_kb_select_authenticated" ON public.support_knowledge_base
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "support_kb_admin_select_all" ON public.support_knowledge_base
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_kb_admin_insert" ON public.support_knowledge_base
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_kb_admin_update" ON public.support_knowledge_base
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_kb_admin_delete" ON public.support_knowledge_base
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_support_kb_updated
  BEFORE UPDATE ON public.support_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Busca full-text ranqueada (RAG leve, sem embeddings/pgvector -> sem custo
-- de IA extra) usada pelo motor de atendimento pra achar os fatos mais
-- relevantes da base de conhecimento pra pergunta do cliente. SEM SECURITY
-- DEFINER de propósito: roda com o mesmo cliente autenticado do usuário, e
-- a RLS de support_knowledge_base (is_active) já filtra o que pode ver.
CREATE OR REPLACE FUNCTION public.search_support_kb(query TEXT, match_count INT DEFAULT 5)
RETURNS SETOF public.support_knowledge_base
LANGUAGE sql STABLE AS $$
  SELECT *
  FROM public.support_knowledge_base
  WHERE is_active AND search_vector @@ websearch_to_tsquery('portuguese', query)
  ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', query)) DESC
  LIMIT match_count;
$$;
REVOKE ALL ON FUNCTION public.search_support_kb(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_support_kb(text, int) TO authenticated, service_role;

-- ---------- support_escalations ----------
CREATE TABLE public.support_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  -- Resumo automático gerado pelo bot na hora de escalar (produto + o que
  -- já foi tentado) — pra quem for atender não precisar reler tudo.
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_support_escalations_status ON public.support_escalations(status, created_at DESC);

GRANT SELECT, INSERT ON public.support_escalations TO authenticated;
GRANT ALL ON public.support_escalations TO service_role;
ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_escalations_select_own" ON public.support_escalations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "support_escalations_insert_own" ON public.support_escalations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "support_escalations_admin_select_all" ON public.support_escalations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_escalations_admin_update" ON public.support_escalations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- support_unanswered_questions ----------
-- Fila de "o bot não soube responder" — fonte pra eu (dono) transformar em
-- conhecimento novo depois (ver painel admin).
CREATE TABLE public.support_unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.support_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  -- O que o bot respondeu mesmo sem certeza (normalmente "vou chamar
  -- alguém pra te ajudar com isso") — contexto pra quem for revisar.
  context TEXT,
  category TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_unanswered_reviewed ON public.support_unanswered_questions(reviewed, created_at DESC);

GRANT SELECT, INSERT ON public.support_unanswered_questions TO authenticated;
GRANT ALL ON public.support_unanswered_questions TO service_role;
ALTER TABLE public.support_unanswered_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_unanswered_insert_own" ON public.support_unanswered_questions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "support_unanswered_select_own" ON public.support_unanswered_questions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "support_unanswered_admin_select_all" ON public.support_unanswered_questions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "support_unanswered_admin_update" ON public.support_unanswered_questions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- storage: mídia do chat (foto/print/áudio enviados) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-media', 'support-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "support_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "support_media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "support_media_admin_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-media' AND public.has_role(auth.uid(), 'admin'));
