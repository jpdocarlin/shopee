-- Origem do anúncio: 'shoppfy' = publicado pelo Criar Anúncio (o sistema pode
-- pausar/reativar sozinho); 'imported' = trazido da loja (pode ser de outro
-- fornecedor — nunca é pausado automaticamente).
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'shoppfy'
  CHECK (source IN ('shoppfy', 'imported'));
UPDATE public.listings SET source = 'imported';
