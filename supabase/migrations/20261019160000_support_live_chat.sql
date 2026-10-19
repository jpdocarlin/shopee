-- Atendimento ao vivo: quando o bot não resolve, o dono assume e responde na
-- própria conversa (sem WhatsApp). Status novos:
--   human  = dono no atendimento (bot fica em silêncio nessa conversa)
--   closed = finalizada (botão "Finalizar" ou 10 min sem resposta do cliente
--            depois da última resposta do dono)
-- Mensagem do dono = role 'agent'.

ALTER TABLE public.support_conversations
  DROP CONSTRAINT IF EXISTS support_conversations_status_check;
ALTER TABLE public.support_conversations
  ADD CONSTRAINT support_conversations_status_check
  CHECK (status IN ('open', 'resolved', 'escalated', 'human', 'closed'));

ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS human_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_last_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_role_check;
ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'agent'));
