-- =========================================================
-- SUPPORT BOT · base de conhecimento inicial
-- =========================================================
-- Só fatos reais confirmados no código/produto do Shoppfy nesta data — nada
-- inventado. Editável depois pelo painel administrativo (tabela
-- support_knowledge_base), sem precisar mexer em código.

INSERT INTO public.support_knowledge_base (category, question, answer, keywords) VALUES
('geral', 'O que é o Shoppfy?',
 'Shoppfy é a plataforma pra quem revende e se afilia a produtos na Shopee e no Mercado Livre: tem catálogo de produtos, criação de anúncio como lojista (dropshipping via fornecedor C7Drop), afiliação, divulgação em grupos de WhatsApp/Facebook, ferramentas de IA (foto, vídeo, texto) e edição de vídeo, tudo num painel só.',
 ARRAY['shoppfy','o que é','sistema','plataforma']),

('geral', 'Quais são as principais áreas do Shoppfy?',
 'Dashboard (resumo de performance), Produtos (catálogo), Favoritos, Criar Anúncio (revenda como lojista), Pedidos (registro de vendas pro fornecedor), Grupos de Divulgação, Meus Links (afiliado), IA (foto/vídeo/texto), Editor de Vídeo, Ranking, Integrações e Configurações.',
 ARRAY['menu','áreas','funcionalidades','o que tem no sistema']),

('como_usar', 'Como eu começo a vender pelo Shoppfy?',
 'O caminho mais direto é Criar Anúncio: escolher um produto do catálogo do fornecedor C7Drop, definir o preço de venda, gerar o texto e a foto do anúncio com IA, e publicar direto na sua loja Shopee conectada.',
 ARRAY['começar','primeiro passo','como vender','criar anúncio']),

('criar_anuncio', 'Como funciona o Criar Anúncio?',
 'É um fluxo de 5 passos: 1) escolher o produto do catálogo C7Drop que você vai revender; 2) definir o preço de venda (a calculadora já mostra a taxa do marketplace e o lucro); 3) gerar título, descrição e palavras-chave do anúncio com IA; 4) gerar a foto de capa com IA; 5) publicar direto na loja Shopee conectada, usando a API oficial.',
 ARRAY['criar anúncio','passo a passo','como anunciar','publicar produto']),

('criar_anuncio', 'Quanto a Shopee cobra de taxa quando eu revendo um produto?',
 'Tabela vigente em 2026: até R$79,99 -> 20% + R$4,00 fixo; de R$80 a R$99,99 -> 14% + R$16,00; de R$100 a R$199,99 -> 14% + R$20,00; acima de R$200 -> 14% + R$26,00. A calculadora do Criar Anúncio já aplica isso automaticamente, mas o marketplace muda a tabela de vez em quando -- vale conferir no painel do próprio vendedor Shopee antes de fechar o preço.',
 ARRAY['taxa shopee','comissão','quanto a shopee cobra','tabela de taxas']),

('criar_anuncio', 'Quanto o Mercado Livre cobra de taxa?',
 'No anúncio clássico: até R$78,99 -> 12% + R$6,50 fixo; acima de R$79 -> 12% sem taxa fixa.',
 ARRAY['taxa mercado livre','comissão ml','tabela mercado livre']),

('criar_anuncio', 'Tem custo de embalagem no Criar Anúncio?',
 'Sim, é somado um custo fixo de R$2,00 de embalagem em cima do custo do produto, no cálculo de lucro.',
 ARRAY['embalagem','custo extra','r$2','taxa de embalagem']),

('criar_anuncio', 'Quem publica o anúncio criado, eu ou o Shoppfy?',
 'Você. No Passo 5 (Publique na Shopee), o anúncio vai direto pra SUA loja Shopee, usando a conexão que você mesmo autorizou em Integrações -- cada conta do Shoppfy publica na própria loja, ninguém usa a loja de outra pessoa.',
 ARRAY['quem publica','minha loja','publicar anúncio']),

('fornecedor', 'Quem é o fornecedor dos produtos?',
 'C7Drop, fornecedora de dropshipping -- os produtos do catálogo de revenda saem direto do estoque dela.',
 ARRAY['fornecedor','c7drop','quem fornece','dropshipping']),

('fornecedor', 'Qual endereço eu uso como origem/expedição ao configurar minha loja na Shopee?',
 'Parque Dom Pedro II, 268 -- Apto 22, Centro, São Paulo - SP, 01022-050 (endereço da C7Drop). Esse endereço fica disponível pra copiar direto na página Integrações.',
 ARRAY['endereço','origem','expedição','endereço c7drop']),

('pedidos', 'O que eu faço depois que vendo um produto?',
 'Você registra a venda em Pedidos: nome do produto, custo do produto (sem sua margem), etiqueta de envio e comprovante do PIX, além dos seus dados de contato (nome, e-mail, telefone e CPF ou CNPJ).',
 ARRAY['registrar venda','pedidos','depois de vender']),

('pedidos', 'Como funciona o pagamento do pedido pro fornecedor?',
 'Por PIX -- a tela de Pedidos mostra o QR code e o código copia-e-cola pra pagar o custo do produto (mais os R$2,00 de embalagem).',
 ARRAY['pagamento pedido','pix','como pagar o fornecedor']),

('pedidos', 'Preciso converter a etiqueta pra PDF antes de enviar?',
 'Não precisa converter você mesmo -- pode enviar a etiqueta como imagem que o sistema converte pra PDF automaticamente.',
 ARRAY['etiqueta','pdf','converter etiqueta']),

('pedidos', 'Quais são os status possíveis de um pedido?',
 'Aguardando, Confirmado, Enviado e Cancelado.',
 ARRAY['status pedido','aguardando','confirmado','enviado','cancelado']),

('pedidos', 'Por que eu não vejo a aba "Pedidos (Admin)"?',
 'Essa aba é restrita: só aparece pra contas com permissão especial de administração de pedidos, e mostra todos os pedidos enviados por todos os revendedores. A maioria das contas não vê essa aba, e isso é esperado, não é erro.',
 ARRAY['pedidos admin','aba admin','não aparece pedidos admin']),

('shopee', 'Como eu conecto minha loja Shopee ao Shoppfy?',
 'Em Integrações, clique em "Conectar loja Shopee" -- isso abre a autorização oficial da Shopee Open Platform (OAuth). Depois de autorizar, sua loja aparece como conectada e você já pode publicar produtos direto pelo Criar Anúncio.',
 ARRAY['conectar shopee','integrar shopee','autorizar loja']),

('shopee', 'Preciso conectar minha loja Shopee de novo se eu trocar de celular ou navegador?',
 'Não -- a conexão fica salva na sua conta do Shoppfy (não no navegador), então funciona em qualquer aparelho que você fizer login.',
 ARRAY['reconectar shopee','trocar de aparelho','perdeu conexão shopee']),

('shopee', 'A extensão do Chrome é obrigatória pra usar o Shoppfy?',
 'Não. A extensão é só pra virar afiliado com um clique em qualquer produto da Shopee (gera o link automaticamente e salva em Meus Links). Pra revender como lojista, o caminho é Criar Anúncio, que não depende da extensão.',
 ARRAY['extensão obrigatória','preciso da extensão']),

('shopee', 'Como eu instalo a extensão do Chrome do Shoppfy?',
 'Baixe em Integrações, descompacte o .zip, abra chrome://extensions, ative o "Modo do desenvolvedor", clique em "Carregar sem compactação" e selecione a pasta descompactada. Ela ainda não está na Chrome Web Store (exige revisão da Google), então precisa ser instalada assim manualmente. Também é preciso estar logado no Portal de Afiliados da Shopee no mesmo navegador.',
 ARRAY['instalar extensão','chrome extensions','modo desenvolvedor']),

('afiliados', 'Como funciona virar afiliado de um produto?',
 'Com a extensão do Chrome instalada, clique em "Virar afiliado (Shopfy)" em qualquer produto da Shopee -- o link de afiliado cai automaticamente em Meus Links, sem precisar copiar e colar nada.',
 ARRAY['virar afiliado','link de afiliado','como me afiliar']),

('afiliados', 'Onde ficam salvos os meus links de afiliado?',
 'Em Meus Links -- ficam guardados na sua conta (não só no navegador), então aparecem em qualquer aparelho que você logar.',
 ARRAY['meus links','onde estão meus links','sumiu o link']),

('afiliados', 'Como funciona Grupos de Divulgação?',
 'Mostra links de grupos de WhatsApp e Facebook organizados por nicho, e tem um gerador de post pronto (com mini-história e foto) pra você colar direto nesses grupos.',
 ARRAY['grupos de divulgação','grupos whatsapp','grupos facebook','post pronto']),

('ia', 'O que a aba IA faz?',
 'Tem duas partes: "Foto/Script" (gera uma foto profissional do produto com IA e uma mini-história de divulgação estilo "achadinhos") e "Cenas de Vídeo" (gera uma imagem de referência da cena e o texto falado pra você gravar um vídeo curto, com cenário e gênero configuráveis).',
 ARRAY['aba ia','o que a ia faz','gerar foto','gerar vídeo com ia']),

('ia', 'Qual IA o Shoppfy usa?',
 'O Gemini, da Google -- tanto pra gerar texto (título, descrição, histórias, scripts) quanto pra gerar imagem (foto de produto e cenas de vídeo).',
 ARRAY['qual ia','gemini','google']),

('creditos_limites', 'Existe limite de uso da IA?',
 'Sim, existe um limite anti-abuso por usuário (poucos minutos de espera se você gerar muita coisa muito rápido) -- é só uma proteção contra uso automatizado, não é um limite comercial do plano.',
 ARRAY['limite de ia','limite de geração','cota de ia']),

('creditos_limites', 'O limite de geração de IA é por dia ou por minuto?',
 'É uma janela curta (poucos minutos) por usuário -- passado esse tempo o limite libera de novo sozinho. Não é um limite diário.',
 ARRAY['limite por dia','quantas gerações','limite ia por minuto']),

('erro_tecnico', 'Por que apareceu "erro 429" ao gerar texto ou foto?',
 'É um limite temporário da própria IA do Google, geralmente por causa de muita gente usando ao mesmo tempo. O sistema já tenta de novo sozinho automaticamente antes de mostrar erro. Se continuar acontecendo, espere alguns minutos e tente de novo.',
 ARRAY['erro 429','limite gemini','ia sobrecarregada','não gerou texto']),

('erro_tecnico', 'O que fazer se uma tela não carregar ou aparecer um erro estranho?',
 'Primeiro tente recarregar a página -- o Shoppfy é atualizado com frequência e às vezes o navegador fica com uma versão antiga guardada em cache. Se o erro continuar depois de recarregar, é um caso pra time técnico analisar.',
 ARRAY['tela não carrega','erro estranho','bug','recarregar página']),

('videos', 'O que é o Editor de Vídeo?',
 'Uma ferramenta pra cortar e legendar seu vídeo direto no navegador (sem instalar nada) e exportar o resultado pronto pra postar.',
 ARRAY['editor de vídeo','cortar vídeo','legendar vídeo']),

('plano', 'Quais são os planos do Shoppfy e quanto custam?',
 'Mensal (R$149,00) ou Vitalício (R$249,00). O plano é escolhido em Configurações -> Plano e cobrança.',
 ARRAY['planos','preço','quanto custa','mensal','vitalício']),

('login_acesso', 'Como eu crio minha conta no Shoppfy?',
 'O acesso é liberado automaticamente depois do pagamento -- não existe cadastro público direto dentro do app. Login e senha chegam pelo e-mail usado na compra.',
 ARRAY['criar conta','cadastro','como entrar','primeiro acesso']),

('login_acesso', 'Esqueci minha senha ou quero trocar, como faço?',
 'Em Configurações -> Segurança dá pra definir uma nova senha.',
 ARRAY['trocar senha','esqueci a senha','redefinir senha']),

('login_acesso', 'Por que o Dashboard ou o Ranking aparecem zerados na minha conta?',
 'Se a conta é nova, os números começam mesmo zerados -- não é bug. Os valores vão aparecendo conforme o uso real.',
 ARRAY['dashboard zerado','ranking zerado','números zerados']),

('geral', 'O Shoppfy tem versão em inglês?',
 'Tem -- em Configurações -> Regional dá pra trocar entre português (Brasil) e inglês.',
 ARRAY['idioma','inglês','mudar idioma','english']),

('reembolso', 'Como funciona o pedido de reembolso?',
 'Em Configurações -> Reembolso dá pra preencher o motivo e enviar a solicitação -- não é automático, precisa ser analisado por um humano depois do envio.',
 ARRAY['reembolso','cancelar plano','devolver dinheiro']);
