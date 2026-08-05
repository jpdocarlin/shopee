// Dicionário de tradução leve (PT → EN) usado pela UI do Shopfy.
// A chave é sempre o texto original em português (fonte de verdade usada em
// todo o app); a tradução é aplicada em tempo de render via t()/useT().
// Strings que não estiverem no dicionário simplesmente aparecem em português
// mesmo com o idioma em inglês (fallback seguro, nunca quebra a UI).
import { useLocaleStore } from "@/stores/locale-store";

const en: Record<string, string> = {
  // Saudação do dashboard
  "Bom dia": "Good morning",
  "Boa tarde": "Good afternoon",
  "Boa noite": "Good evening",

  // Grupos de navegação
  "Visão geral": "Overview",
  Produtos: "Products",
  Divulgação: "Promotion",
  Receita: "Revenue",
  Sistema: "System",

  // Itens de navegação (labels)
  Dashboard: "Dashboard",
  Favoritos: "Favorites",
  "Grupos de Divulgação": "Promotion Groups",
  "Meus Links": "My Links",
  IA: "AI",
  Integrações: "Integrations",
  Configurações: "Settings",

  // Itens de navegação (descriptions / tooltips)
  "Resumo de performance e ganhos": "Performance and earnings summary",
  "Base de produtos monitorados": "Monitored product base",
  "Produtos salvos por você": "Products you've saved",
  "WhatsApp e Facebook por nicho + post pronto pra colar":
    "WhatsApp and Facebook by niche + ready-to-paste post",
  "Todos os links de afiliado que você já gerou": "All the affiliate links you've generated",
  "Geração de conteúdo e insights": "Content generation and insights",
  "APIs, webhooks e automações": "APIs, webhooks and automations",
  "Conta, equipe e preferências": "Account, plan and preferences",
  "Conta, plano e preferências": "Account, plan and preferences",
  Marketplace: "Marketplace",
  Comissões: "Commissions",
  Catálogo: "Catalog",
  Pedidos: "Orders",
  "Catálogo atualizado": "Catalog updated",

  // Mobile nav / command palette
  Navegação: "Navigation",
  "Abrir menu": "Open menu",
  "Digite um comando ou pesquise…": "Type a command or search…",
  "Nenhum resultado encontrado.": "No results found.",
  Ações: "Actions",
  "Conectar marketplace": "Connect marketplace",
  "Falar com o suporte": "Talk to support",

  // Page headers
  "Produtos salvos para acompanhar preço, comissão e disponibilidade.":
    "Saved products to track price, commission and availability.",
  "Todos os links de afiliado que você já gerou, num só lugar — copie de novo ou remova quando não quiser mais divulgar.":
    "All the affiliate links you've generated, in one place — copy again or remove when you no longer want to promote them.",
  "Cliques, sessões, conversão e desempenho por canal e produto.":
    "Clicks, sessions, conversion and performance by channel and product.",
  "Catálogo de produtos disponíveis para afiliação na Shopee e no Mercado Livre.":
    "Catalog of products available for affiliation on Shopee and Mercado Livre.",
  "Mineração de produtos vencedores nos marketplaces com filtros inteligentes.":
    "Mining winning products across marketplaces with smart filters.",
  "Contas, canais e credenciais conectadas de Shopee e Mercado Livre.":
    "Connected Shopee and Mercado Livre accounts, channels and credentials.",
  "Regras, faixas e valores de comissão por marketplace e categoria.":
    "Commission rules, tiers and values by marketplace and category.",
  "Grupos do Facebook organizados por nicho + post pronto pra colar, um produto de cada vez.":
    "Facebook groups organized by niche + ready-to-paste post, one product at a time.",
  "Conta, plano, segurança e preferências do sistema.":
    "Account, plan, security and system preferences.",
  "Coleções e vitrines publicáveis montadas a partir dos seus produtos.":
    "Publishable collections and showcases built from your products.",
  "Saldo, chaves Pix, saques e extrato completo da sua operação.":
    "Balance, Pix keys, withdrawals and full statement of your operation.",
  "Vendas atribuídas aos seus links, com status e valor de comissão.":
    "Sales attributed to your links, with status and commission value.",
  "Escolha um produto, gere a mídia de divulgação e o script de depoimento pra postar.":
    "Pick a product, generate the promo media and the testimonial script to post.",
  "APIs, webhooks, automações e conexões com ferramentas externas.":
    "APIs, webhooks, automations and connections with external tools.",
  "Visão consolidada de cliques, conversões e comissões dos seus links de afiliado.":
    "Consolidated view of clicks, conversions and commissions from your affiliate links.",

  // Configurações — abas
  "Perfil e conta": "Profile and account",
  "Plano e cobrança": "Plan and billing",
  Segurança: "Security",
  Notificações: "Notifications",
  Regional: "Regional",
  Reembolso: "Refund",

  // Configurações — Perfil
  Identidade: "Identity",
  "Como seu nome aparece dentro do Shopfy.": "How your name appears inside Shopfy.",
  Nome: "Name",
  "Como quer ser chamado?": "What should we call you?",
  "E-mail": "Email",
  "Salvar alterações": "Save changes",
  "Perfil atualizado": "Profile updated",

  // Configurações — Plano
  "Seu plano": "Your plan",
  "Plano Pro": "Pro plan",
  "R$ 49,00/mês · próxima cobrança em 5 de setembro":
    "$49.00/month · next billing on September 5th",
  "Trocar plano": "Change plan",
  "Planos disponíveis em breve nesta tela": "Plans will be available on this screen soon",
  Cobrança: "Billing",
  "Forma de pagamento e histórico de faturas.": "Payment method and invoice history.",
  "Cartão terminado em 4242": "Card ending in 4242",
  Atualizar: "Update",
  "Atualização de cartão em breve nesta tela": "Card update available on this screen soon",
  "Ver faturas": "View invoices",
  "Nenhuma fatura anterior ainda": "No previous invoices yet",

  // Configurações — Segurança
  Senha: "Password",
  "Alterar senha": "Change password",
  "Link de redefinição enviado": "Reset link sent",
  "Confira sua caixa de entrada em conta@shoppfy.com": "Check your inbox at conta@shoppfy.com",
  "Verificação em duas etapas": "Two-factor authentication",
  "Peça um código extra por e-mail sempre que entrar de um aparelho novo.":
    "Request an extra code by email whenever you sign in from a new device.",
  "Ativar verificação em duas etapas": "Enable two-factor authentication",
  "Ativada — protegendo sua conta": "Enabled — protecting your account",
  Desativada: "Disabled",
  "Verificação em duas etapas ativada": "Two-factor authentication enabled",
  "Verificação desativada": "Verification disabled",
  "Sessões ativas": "Active sessions",
  "Aparelhos conectados à sua conta agora.": "Devices currently connected to your account.",
  "Este aparelho": "This device",
  "Chrome · sessão atual": "Chrome · current session",
  Ativa: "Active",

  // Configurações — Notificações
  "Notificações por e-mail": "Email notifications",
  "Escolha o que você quer receber.": "Choose what you want to receive.",
  "Novas vendas atribuídas": "New attributed sales",
  "Avise sempre que um dos seus links gerar uma venda":
    "Notify whenever one of your links generates a sale",
  "Queda de preço": "Price drop",
  "Avise quando um produto favoritado ficar mais barato":
    "Notify when a favorited product gets cheaper",
  "Novidades do produto": "Product updates",
  "Lançamentos de recursos e melhorias do Shopfy": "Shopfy feature launches and improvements",
  "Resumo semanal": "Weekly summary",
  "Um e-mail toda segunda com o desempenho da semana":
    "An email every Monday with the week's performance",
  "Alerta de vendas": "Sales alert",
  "Alerta de preço": "Price alert",
  Novidades: "Updates",
  ativado: "enabled",
  desativado: "disabled",

  // Configurações — Regional
  "Preferências regionais": "Regional preferences",
  "Moeda, idioma e fuso horário usados na plataforma.":
    "Currency, language and time zone used on the platform.",
  Moeda: "Currency",
  "Real (R$)": "Real (R$)",
  "Dólar (US$)": "Dollar (US$)",
  "Moeda atualizada": "Currency updated",
  Idioma: "Language",
  "Português (Brasil)": "Portuguese (Brazil)",
  "English (US)": "English (US)",
  "Idioma atualizado": "Language updated",
  "Fuso horário": "Time zone",
  "Brasília (GMT-3)": "Brasília (GMT-3)",
  "Manaus (GMT-4)": "Manaus (GMT-4)",
  "Fernando de Noronha (GMT-2)": "Fernando de Noronha (GMT-2)",
  "Fuso horário atualizado": "Time zone updated",

  // Configurações — Reembolso
  "Solicitar reembolso": "Request refund",
  "Sentiu que o Shopfy não é pra você? Preencha os dados abaixo pra pedir seu reembolso.":
    "Feel like Shopfy isn't for you? Fill in the details below to request your refund.",
  "Nome completo": "Full name",
  "Seu nome completo": "Your full name",
  CPF: "Tax ID (CPF)",
  "E-mail:voce@exemplo.com": "you@example.com",
  "voce@exemplo.com": "you@example.com",
  "Código da compra": "Order code",
  "Ex: PED-48213": "e.g. ORD-48213",
  "Plano da cobrança": "Billing plan",
  "Selecione o plano": "Select the plan",
  "Pro — Mensal (R$ 49,00/mês)": "Pro — Monthly ($49.00/month)",
  "Pro — Anual (R$ 470,00/ano)": "Pro — Annual ($470.00/year)",
  "Há quantos dias você pagou?": "How many days ago did you pay?",
  "Ex: 3": "e.g. 3",
  "Por que você quer reembolso?": "Why do you want a refund?",
  "Selecione um motivo": "Select a reason",
  "Não estou usando o sistema": "I'm not using the system",
  "Não atendeu o que eu esperava": "It didn't meet my expectations",
  "Encontrei uma alternativa melhor": "I found a better alternative",
  "Tive problemas técnicos": "I had technical issues",
  "Outro motivo": "Other reason",
  "Pedido de reembolso enviado": "Refund request sent",
  "Pedido de reembolso": "Refund request",
  "Recebemos seu pedido de reembolso": "We've received your refund request",
  "Enviar outro pedido": "Send another request",
  Sessão: "Session",
  "Sair da conta": "Log out",
  "Por lei (CDC, art. 49), compras feitas online têm direito a arrependimento e reembolso integral em até 7 dias do pagamento. Pagamentos com menos de 7 dias são estornados em até 7 dias úteis na forma de pagamento original; após esse prazo, o valor não é estornado — vale revisar o texto exato com um advogado antes de publicar.":
    "By law (Brazilian consumer code, art. 49), online purchases carry a right of withdrawal with full refund up to 7 days after payment. Payments made less than 7 days ago are refunded within up to 7 business days to the original payment method; after that window, the amount is not refunded — worth reviewing the exact wording with a lawyer before publishing.",
};

export type Locale = "pt" | "en";

export function translate(text: string, locale: Locale): string {
  if (locale === "pt") return text;
  return en[text] ?? text;
}

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (text: string) => translate(text, locale);
}
