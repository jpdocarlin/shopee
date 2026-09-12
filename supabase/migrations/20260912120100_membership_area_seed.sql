-- Seed inicial da área de membros — grade fechada com o Jp em 12/09/2026
-- (revenda com produtos do fornecedor, sem afiliado/IA/vídeo). Durações são
-- estimativas — trocar pelo tempo real assim que o Jp gravar cada aula.

INSERT INTO public.course_modules (slug, title, description, order_index) VALUES
  ('fundamentos', 'Comece por aqui', 'Entenda o modelo de negócio e conecte sua loja — a base de tudo.', 0),
  ('primeiro-anuncio', 'Seu primeiro anúncio', 'Escolha o preço certo e publique seu primeiro anúncio usando produtos do fornecedor.', 1),
  ('pos-venda', 'Pós-venda e gestão', 'O que fazer depois que a venda acontece, e como manter tudo redondo.', 2);

INSERT INTO public.course_lessons (module_id, slug, title, description, order_index, duration_seconds) VALUES
  (
    (SELECT id FROM public.course_modules WHERE slug = 'fundamentos'),
    'como-funciona',
    'Como funciona o Shoppfy',
    'O modelo por trás do Shoppfy: você escolhe um produto do catálogo do fornecedor, cria seu próprio anúncio com o preço que você define, e quando vende, o pedido é repassado pro fornecedor cumprir. O lucro é a margem entre o que você cobra e o custo do fornecedor.',
    0,
    480
  ),
  (
    (SELECT id FROM public.course_modules WHERE slug = 'fundamentos'),
    'conectando-sua-loja',
    'Conectando sua loja Shopee ou Mercado Livre',
    'Passo a passo pra conectar sua conta Shopee ou Mercado Livre ao Shoppfy — o primeiro passo obrigatório antes de qualquer outra coisa na plataforma.',
    1,
    720
  ),
  (
    (SELECT id FROM public.course_modules WHERE slug = 'primeiro-anuncio'),
    'criando-seu-anuncio',
    'Criando e publicando seu anúncio',
    'Como escolher o produto certo no catálogo do fornecedor, definir seu preço e sua margem, e publicar o anúncio direto na Shopee sem sair do Shoppfy.',
    0,
    840
  ),
  (
    (SELECT id FROM public.course_modules WHERE slug = 'primeiro-anuncio'),
    'divulgando-e-ritmo',
    'Divulgando seu anúncio e o ritmo ideal',
    'Onde e como divulgar seu anúncio pra gerar visita, e quantos anúncios publicar por dia pra manter o ritmo sem se perder.',
    1,
    600
  ),
  (
    (SELECT id FROM public.course_modules WHERE slug = 'pos-venda'),
    'pedidos-e-rastreio',
    'Depois da venda: pedidos e rastreio',
    'O que acontece depois que alguém compra: como o pedido é repassado pro fornecedor, prazos e como acompanhar o rastreio até a entrega.',
    0,
    540
  ),
  (
    (SELECT id FROM public.course_modules WHERE slug = 'pos-venda'),
    'configuracoes-e-suporte',
    'Configurações, plano e suporte',
    'Ajustando seu perfil e plano nas Configurações, e como o Atendimento resolve a maioria das dúvidas na hora.',
    1,
    420
  );
