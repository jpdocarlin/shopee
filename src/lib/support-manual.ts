// Manual do Shoppfy pro bot de atendimento — fonte da verdade sobre o
// produto. Tudo aqui foi conferido no código/regras do Shoppfy em 19/10/2026.
// Quando algo mudar no sistema, atualize AQUI (o bot só sabe o que está escrito).
//
// Regra: nunca citar o nome do fornecedor pro cliente ("nosso fornecedor").
export const SHOPPFY_MANUAL = `
# O QUE É O SHOPPFY
Sistema pra vender na Shopee e no Mercado Livre SEM ESTOQUE. O cliente escolhe produtos do catálogo do nosso fornecedor, o Shoppfy cria o anúncio (título e descrição com IA) e publica direto na loja dele pela API oficial. Quando ele vende, registra o pedido no Shoppfy, paga o custo do produto por Pix e o fornecedor embala e envia pro comprador final. O cliente nunca toca no produto.

# PRIMEIROS PASSOS (ordem certa)
1. Ter uma loja de vendedor na Shopee (seller.shopee.com.br) e/ou conta no Mercado Livre apta a vender, com cadastro completo (documento e dados bancários).
2. No Shoppfy, menu Integrações → "Conectar loja Shopee" e/ou "Conectar Mercado Livre". Abre a autorização oficial do marketplace; é só entrar na conta e autorizar.
3. Na mesma página Integrações tem o cartão "Endereço de origem" com botão Copiar: esse é o endereço de onde os produtos saem. Cadastre ele como endereço de envio/coleta da loja (Shopee: Seller Center → Configurações da loja/Endereços; Mercado Livre: Configurações de envio).
4. Ative pelo menos uma forma de envio na loja (Shopee: Seller Center → Envio → ativar transportadoras; Mercado Livre: ativar Mercado Envios).
5. Menu Criar Anúncio → publicar os produtos.
6. Aulas em vídeo: ícone de capelo (Área de Membros) no topo do sistema.

# CRIAR ANÚNCIO (5 passos na mesma página)
- Antes de começar, escolha no topo "Publicar em: Shopee ou Mercado Livre".
- Passo 1: escolher o produto do catálogo (dá pra filtrar por nicho e buscar). O preço que aparece é o CUSTO (o que você paga ao fornecedor).
- Passo 2: definir o preço de venda. A calculadora mostra a taxa do marketplace e o lucro. Botões de margem sugerida (recomendado 20% a 30% de lucro). Se o preço der prejuízo, aparece aviso vermelho.
- Passo 3: gerar título e descrição com IA. Dá pra editar e gerar outra versão. O título NÃO pode ser igual ao do fornecedor (evita anúncio duplicado). Limite: 120 caracteres na Shopee, 60 no Mercado Livre.
- Passo 4: foto — vem pronta do fornecedor (várias fotos são enviadas automaticamente).
- Passo 5: publicar. Informe estoque (número inteiro, ex. 10) e, na Shopee, o peso em QUILOS (300 gramas = 0,3). A categoria é escolhida automaticamente. Depois de publicar aparece o link "Ver anúncio".
- Se o botão de publicar estiver bloqueado, o sistema mostra embaixo "Por que não dá pra publicar ainda" (falta preço, falta texto, ou não achou categoria segura pra aquele produto → escolha outro produto).
- Só aparece a opção de publicar se a loja daquele marketplace estiver conectada em Integrações.

# ERROS AO PUBLICAR (o sistema já mostra "Não deu pra publicar" + "O que fazer")
SHOPEE
- "Cadastro de vendedor incompleto" / "KYC not pass" / "verificação de identidade": é uma trava da PRÓPRIA Shopee, não erro do Shoppfy. A loja ainda não teve a verificação de identidade aprovada, então a Shopee não deixa criar nenhum produto (nem pelo app dela). O que fazer: abrir o Seller Center (seller.shopee.com.br) ou o app da Shopee na área do vendedor, enviar o que ela pedir na verificação (documento, selfie, dados bancários), esperar a aprovação (geralmente 1 a 3 dias úteis) e publicar de novo pelo Shoppfy.
- Mercado Livre "GTIN"/"código de barras" obrigatório: o Shoppfy agora informa automaticamente que o produto não tem código de barras. Peça pro cliente clicar em Publicar de novo; se repetir, escolher outro produto do catálogo.
- Sem canal de logística: ativar pelo menos uma transportadora em Seller Center → Envio.
- Conexão expirada/desfeita: Integrações → Desconectar na Shopee → Conectar de novo.
- Loja em modo férias/suspensa: desativar modo férias e ver avisos no Seller Center.
- Anúncio duplicado: gerar outra versão do texto ou editar título/descrição.
- Preço fora do permitido: ajustar preço no passo 2.
- Peso inválido: peso é em kg (0,3 e não 300).
- Categoria exige marca/atributos que o catálogo não tem, ou limite de anúncios da loja: escolher outro produto.
MERCADO LIVRE
- Mensagem vermelha de "restrição"/"conta com restrição pra anunciar" (seller.unable_to_list): é bloqueio da CONTA no próprio Mercado Livre. Abrir o app do Mercado Livre, ver os avisos da conta e concluir o que ele pede (verificação de identidade/dados). Depois publicar de novo. Não é erro do Shoppfy.
- Conexão expirada: Integrações → Desconectar no Mercado Livre → Conectar de novo.
- Envio: ativar Mercado Envios na conta.
- Título não aceito: máx. 60 caracteres, sem emoji.
- Categoria exige atributos extras (marca/modelo) ou categoria não aceita: escolher outro produto do catálogo — alguns produtos não têm categoria segura no ML.
GERAL
- Erro de instabilidade/limite ("muitas tentativas"): esperar 1 minuto e tentar de novo.
- Se der erro, abrir "Ver detalhe técnico" mostra a mensagem original.

# DEPOIS QUE VENDE (PEDIDOS) — MUITO IMPORTANTE
- O Shoppfy NÃO puxa as vendas da Shopee/Mercado Livre sozinho. Quando vender, o cliente precisa REGISTRAR o pedido no menu Pedidos. Por isso "a venda não aparece no sistema" até ele registrar.
- O lucro da venda é pago pelo marketplace direto na conta do vendedor (Shopee/ML), não pelo Shoppfy.
- Passo a passo: 1) no painel do marketplace, gerar/baixar a etiqueta de envio da venda; 2) no Shoppfy → Pedidos, preencher OS SEUS dados de revendedor (nome, e-mail, telefone, CPF/CNPJ — não são os dados do comprador; os dados do comprador já estão na etiqueta), escolher o produto (o custo preenche sozinho), anexar a etiqueta (PDF ou imagem — imagem vira PDF automaticamente); 3) pagar o Pix que aparece na tela (QR Code ou copia-e-cola) no valor do custo + R$ 2,00 de embalagem; 4) anexar o comprovante do Pix; 5) enviar.
- Pix: é chave CPF; alguns bancos mostram aviso de "possível fraude" com chave CPF — é normal, pode confirmar.
- Prazo: depois do Pix pago e do pedido enviado, o fornecedor envia em até 24 horas úteis. O código de rastreio aparece no próprio pedido e chega notificação no sininho do Shoppfy.
- Status: Aguardando (recebido, conferindo pagamento) → Confirmado → Enviado (com rastreio) ou Cancelado.
- Cada venda = um pedido no Shoppfy. Sim, paga-se o custo a cada venda (é revenda sem estoque: você só paga o produto quando vende).
- Não existe contato direto com o fornecedor: tudo é feito pelo Shoppfy (Pedidos). Não informe nome nem telefone do fornecedor.

# INTEGRAÇÕES
- Conectar: Integrações → botão Conectar (Shopee ou Mercado Livre).
- Desconectar: Integrações → botão Desconectar no cartão da Shopee ou do Mercado Livre.
- A conexão fica salva na conta (vale em qualquer aparelho).

# VENDAS / DICAS
- Não existe número mágico de anúncios por dia. Funciona melhor publicar com constância (todo dia um pouco), variar produtos e nichos, usar preço competitivo (margem 20–30%) e títulos claros.
- Vendas e cliques dependem do marketplace (ranqueamento, preço, concorrência); a primeira venda pode levar alguns dias. O Dashboard do Shoppfy NÃO mostra vendas da Shopee/ML — acompanhe vendas no painel do marketplace.

# TAXAS (já calculadas no passo 2)
- Shopee: até R$ 79,99 → 20% + R$ 4; R$ 80 a 99,99 → 14% + R$ 16; R$ 100 a 199,99 → 14% + R$ 20; acima de R$ 200 → 14% + R$ 26.
- Mercado Livre (clássico): até R$ 78,99 → 12% + R$ 6,50; acima de R$ 79 → 12%.

# PLANOS, ACESSO E CONTA
- Planos: Mensal R$ 149/mês e Vitalício R$ 249 (pagamento único). Mesmo acesso.
- Login: e-mail da compra + senha. Trocar senha: Configurações → Segurança. NUNCA informe senha padrão nem qualquer senha.
- Mensal: se a assinatura for cancelada, o acesso continua até o fim do mês já pago; se a renovação não for paga, o acesso é suspenso até pagar (os dados ficam guardados).
- Trocar o e-mail da conta, esqueci a senha, cancelar a assinatura mensal: o bot não consegue fazer — use a ação notify_owner.

# REEMBOLSO (garantia de 7 dias)
- Reembolso é pedido DENTRO DO SHOPPFY: Configurações → aba Reembolso → preencher o formulário (nome, CPF, e-mail, código da compra, plano, há quantos dias pagou, motivo) → Enviar.
- Dentro de 7 dias do pagamento tem direito ao reembolso integral; o estorno cai em até 7 dias úteis na mesma forma de pagamento.
- O "código da compra" é o código da transação na plataforma de pagamento. Se o cliente não tiver, você busca pra ele (ação lookup_purchase_code) pedindo o e-mail usado na compra e o nome completo.
- O bot NÃO faz o reembolso nem promete aprovação: sempre direciona pro formulário em Configurações → Reembolso.

# ÁREA DE MEMBROS / AULAS
- Ícone de capelo no topo do sistema. Se um vídeo não carregar: recarregar a página; se continuar, notify_owner.

# O QUE NÃO EXISTE MAIS (não ofereça)
- Links de afiliado, "se afiliar a produto", Grupos de divulgação, IA de foto/vídeo, Editor de vídeo, Ranking, Favoritos, extensão do Chrome. Se perguntarem, explique que o Shoppfy agora é focado em vender como lojista sem estoque (Criar Anúncio + Pedidos).
`;
