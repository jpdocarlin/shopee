// Traduz o erro cru da Shopee / Mercado Livre (JSON da API, em inglês) em
// "por que não publicou" + "o que fazer", em português simples, pra pessoa
// entender sem precisar chamar o suporte. O texto técnico original continua
// disponível (escondido) pra quando precisar mandar print pro suporte.
//
// Ordem das regras importa: as mais específicas vêm primeiro.

export type Marketplace = "shopee" | "mercado-livre";

export type PublishErrorExplanation = {
  reason: string;
  fix: string;
  // Erro cru da API — só aparece quando a mensagem original era técnica.
  technical?: string;
};

type Rule = { test: RegExp; reason: string; fix: string };

const COMMON_RULES = (label: string): Rule[] => [
  {
    test: /too many requests|rate.?limit|\b429\b|request limit/i,
    reason: `A ${label} recebeu muitas tentativas seguidas e pediu pra esperar um pouco.`,
    fix: "Espere 1 minuto e clique em publicar de novo.",
  },
  {
    test: /error_server|internal error|timeout|timed out|fetch failed|ECONN|ETIMEDOUT|\b50[234]\b|service unavailable/i,
    reason: `A ${label} ficou instável na hora de receber o anúncio (problema do lado dela, não seu).`,
    fix: "Espere alguns minutos e tente publicar de novo.",
  },
];

// Travas de CONTA/LOJA no marketplace (não são erro do Shoppfy). Valem
// mesmo quando o servidor já mandou uma mensagem em português, porque o
// cliente precisa do passo a passo pra destravar.
const SHOPEE_ACCOUNT_RULES: Rule[] = [
  {
    test: /kyc|cadastro de vendedor|verifica[cç][aã]o de identidade|identity verif/i,
    reason:
      "A própria Shopee bloqueou a criação de produtos na sua loja porque a verificação de identidade (KYC) da loja ainda não foi aprovada. Isso não é erro do Shoppfy: enquanto a Shopee não aprovar, nenhum produto pode ser criado, nem pelo Shoppfy nem direto no app.",
    fix: "1) Abra o Seller Center (seller.shopee.com.br) ou o app da Shopee na área do vendedor. 2) Procure o aviso de verificação de identidade / cadastro do vendedor e envie o que ela pedir (documento, selfie e dados bancários). 3) Espere a Shopee aprovar — costuma levar de 1 a 3 dias úteis. 4) Depois de aprovado, volte aqui e clique em Publicar de novo.",
  },
];

const ML_ACCOUNT_RULES: Rule[] = [
  {
    test: /restri[cç][aã]o pra anunciar|seller\.unable_to_list|restrictions_coliving|unable to list/i,
    reason:
      "O próprio Mercado Livre bloqueou sua conta de criar anúncios novos (cadastro incompleto, verificação de identidade pendente ou alguma restrição). Isso não é erro do Shoppfy.",
    fix: "1) Abra o app do Mercado Livre. 2) Veja os avisos da sua conta (sino de notificações e Minha conta) e conclua o que ele pedir — verificação de identidade, dados pessoais ou de faturamento. 3) Depois que a restrição sair, volte aqui e clique em Publicar de novo.",
  },
];

const SHOPEE_RULES: Rule[] = [
  {
    test: /error_auth|invalid.?access.?token|access_token|shop_no_linked|no linked|token.*expired|expired.*token/i,
    reason: "A conexão entre o Shoppfy e a sua loja Shopee expirou ou foi desfeita.",
    fix: "Vá em Integrações, clique em Desconectar na Shopee e conecte a loja de novo. Depois volte aqui e publique.",
  },
  {
    test: /banned|frozen|suspend|holiday|vacation|shop.*(closed|inactive)/i,
    reason:
      "Sua loja Shopee está suspensa, congelada ou em modo férias, e por isso não aceita anúncio novo.",
    fix: "Abra o Seller Center da Shopee, veja os avisos da loja e desative o modo férias (se estiver ligado). Depois publique de novo.",
  },
  {
    test: /duplicat|already exist|same item/i,
    reason:
      "A Shopee entendeu esse anúncio como repetido, parecido demais com outro que já existe.",
    fix: 'Clique em "Gerar outra versão" no texto do anúncio ou edite o título e a descrição com as suas palavras, e publique de novo.',
  },
  {
    test: /item.?(count|number|quantity).*(limit|exceed)|listing limit|exceed.*(item|listing)/i,
    reason: "Sua loja Shopee chegou no limite de anúncios que ela permite ter agora.",
    fix: "Apague ou desative anúncios que não vendem no Seller Center, ou espere a Shopee liberar mais vagas pra sua loja.",
  },
  {
    test: /price/i,
    reason:
      "O preço de venda ficou fora do valor que a Shopee aceita pra esse produto (muito baixo ou muito alto).",
    fix: "Volte no passo 2, ajuste o preço de venda (use uma das margens sugeridas) e publique de novo.",
  },
  {
    test: /weight/i,
    reason: "O peso informado não é aceito pela Shopee.",
    fix: "Confira o campo Peso: ele é em quilos. Um produto de 300 gramas é 0,3 (e não 300 ou 90,3).",
  },
  {
    test: /dimension|package_(length|width|height)/i,
    reason: "As medidas da embalagem não foram aceitas pela Shopee.",
    fix: "Tente publicar de novo. Se continuar, escolha outro produto e avise o suporte com o print desta mensagem.",
  },
  {
    test: /brand/i,
    reason: "Essa categoria da Shopee exige uma marca e não aceitou a que foi enviada.",
    fix: "Escolha outro produto do catálogo ou publique esse manualmente no Seller Center informando a marca.",
  },
  {
    test: /image|picture|photo|foto/i,
    reason: "A Shopee não aceitou as fotos do produto.",
    fix: "Tente publicar de novo. Se continuar, escolha outro produto (as fotos desse podem estar com problema no fornecedor).",
  },
  {
    test: /item_name|name.*(length|character)|title/i,
    reason:
      "O título do anúncio não foi aceito pela Shopee (muito longo, muito curto ou com caracteres não permitidos).",
    fix: "Edite o título: sem emoji, sem símbolos e com no máximo 120 caracteres. Depois publique de novo.",
  },
  {
    test: /description/i,
    reason: "A descrição do anúncio não foi aceita pela Shopee.",
    fix: "Edite a descrição (sem links, telefone ou WhatsApp) ou gere outra versão, e publique de novo.",
  },
  {
    test: /category/i,
    reason: "A Shopee não aceitou a categoria escolhida pra esse produto.",
    fix: "Escolha outro produto do catálogo. Esse não tem uma categoria segura pra publicar automaticamente.",
  },
  {
    test: /mandatory|attribute/i,
    reason:
      "Essa categoria da Shopee exige informações extras do produto (como modelo ou certificado) que o catálogo não tem.",
    fix: "Escolha outro produto do catálogo ou publique esse manualmente no Seller Center preenchendo os dados que faltam.",
  },
  {
    test: /logistic|shipping|channel/i,
    reason: "Sua loja Shopee não tem nenhuma forma de envio ativada.",
    fix: "No Seller Center da Shopee, vá em Minha Loja > Envio e ative pelo menos uma transportadora. Depois publique de novo.",
  },
];

const ML_RULES: Rule[] = [
  {
    test: /invalid_token|invalid.?access.?token|expired_token|unauthorized|\b401\b|invalid_grant/i,
    reason: "A conexão entre o Shoppfy e a sua conta do Mercado Livre expirou ou foi desfeita.",
    fix: "Vá em Integrações, clique em Desconectar no Mercado Livre e conecte a conta de novo. Depois volte aqui e publique.",
  },
  {
    test: /seller\.unable_to_list|unable to list|forbidden|\b403\b/i,
    reason:
      "O próprio Mercado Livre bloqueou sua conta de criar anúncios novos (cadastro incompleto, verificação pendente ou alguma restrição na conta).",
    fix: "Abra o app do Mercado Livre, veja os avisos da sua conta e conclua o que ele pedir. Depois publique de novo por aqui.",
  },
  {
    test: /listing_type/i,
    reason: 'Sua conta do Mercado Livre não pode usar o tipo de anúncio "Clássico" nesse produto.',
    fix: "Confira no Mercado Livre se sua conta está liberada pra anunciar (reputação/cadastro). Se continuar, mande o print pro suporte.",
  },
  {
    test: /shipping|me2|mercado.?envios|logistic|free_shipping/i,
    reason: "O Mercado Livre exige uma forma de envio que ainda não está configurada na sua conta.",
    fix: "No Mercado Livre, vá em Configurações > Envios e ative o Mercado Envios. Depois publique de novo.",
  },
  {
    test: /price/i,
    reason: "O preço de venda ficou fora do valor que o Mercado Livre aceita pra esse produto.",
    fix: "Volte no passo 2, ajuste o preço de venda e publique de novo.",
  },
  {
    test: /picture|image|photo/i,
    reason: "O Mercado Livre não aceitou as fotos do produto.",
    fix: "Tente publicar de novo. Se continuar, escolha outro produto (as fotos desse podem estar com problema no fornecedor).",
  },
  {
    test: /GTIN|EAN|c[oó]digo de barras/i,
    reason:
      "Essa categoria do Mercado Livre pede o código de barras (GTIN/EAN) do produto, e o produto do catálogo não tem um.",
    fix: "Clique em Publicar de novo: o sistema informa automaticamente ao Mercado Livre que o produto não tem código de barras. Se o erro repetir, escolha outro produto do catálogo.",
  },
  {
    test: /missing_required|attribute/i,
    reason:
      "Essa categoria do Mercado Livre exige informações extras do produto (como marca ou modelo) que o catálogo não tem.",
    fix: "Escolha outro produto do catálogo ou publique esse direto no Mercado Livre preenchendo os dados que faltam.",
  },
  {
    test: /available_quantity|stock/i,
    reason: "A quantidade em estoque informada não foi aceita.",
    fix: "Confira o campo Estoque (um número inteiro, ex.: 10) e publique de novo.",
  },
  {
    test: /title|family.?name/i,
    reason: "O título do anúncio não foi aceito pelo Mercado Livre.",
    fix: "Edite o título (sem emoji e com no máximo 60 caracteres) e publique de novo.",
  },
  {
    test: /description/i,
    reason: "A descrição do anúncio não foi aceita pelo Mercado Livre.",
    fix: "Edite a descrição (sem links, telefone ou WhatsApp) ou gere outra versão, e publique de novo.",
  },
  {
    test: /category/i,
    reason: "O Mercado Livre não aceitou a categoria escolhida pra esse produto.",
    fix: "Escolha outro produto do catálogo. Esse não tem uma categoria segura pra publicar automaticamente.",
  },
];

// Mensagens que o próprio servidor já escreve em português claro (ex.: ANATEL,
// cadastro de vendedor, conta restrita no ML). Não reescreve: só separa em
// motivo + o que fazer quando der.
function isAlreadyFriendly(raw: string): boolean {
  return !/^\[(Shopee|Mercado Livre)\]/.test(raw.trim()) && !/[{}[\]]/.test(raw);
}

export function explainPublishError(
  marketplace: Marketplace,
  raw: string,
): PublishErrorExplanation {
  const label = marketplace === "shopee" ? "Shopee" : "Mercado Livre";

  const accountHit = (marketplace === "shopee" ? SHOPEE_ACCOUNT_RULES : ML_ACCOUNT_RULES).find(
    (r) => r.test.test(raw),
  );
  if (accountHit) {
    return {
      reason: accountHit.reason,
      fix: accountHit.fix,
      technical: isAlreadyFriendly(raw) ? undefined : raw,
    };
  }

  if (isAlreadyFriendly(raw)) {
    return { reason: raw, fix: "" };
  }

  // Procura primeiro no "message"/"cause" do JSON (mais preciso), depois no texto todo.
  const rules = [...(marketplace === "shopee" ? SHOPEE_RULES : ML_RULES), ...COMMON_RULES(label)];
  const hit = rules.find((r) => r.test.test(raw));
  if (hit) {
    return { reason: hit.reason, fix: hit.fix, technical: raw };
  }

  return {
    reason: `A ${label} recusou esse anúncio. Normalmente é uma regra da própria ${label} pra esse produto ou pra sua conta, não um erro do Shoppfy.`,
    fix: `1) Clique em Publicar de novo. 2) Se repetir, abra ${marketplace === "shopee" ? "o Seller Center da Shopee" : "o app do Mercado Livre"} e veja se tem algum aviso ou pendência na sua conta. 3) Se estiver tudo certo lá, escolha outro produto do catálogo e mande print desta mensagem (com o detalhe técnico aberto) no Atendimento do Shoppfy.`,
    technical: raw,
  };
}
