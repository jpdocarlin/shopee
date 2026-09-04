import {
  LayoutDashboard,
  Package,
  Heart,
  Sparkles,
  Plug,
  Settings,
  Facebook,
  Link2,
  Trophy,
  Clapperboard,
  Store,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  shortcut?: string;
  // Só aparece pra conta com role "admin" (user_roles). Ver useIsOwner().
  ownerOnly?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        description: "Resumo de performance e ganhos",
        shortcut: "G D",
      },
      {
        label: "Ranking",
        to: "/ranking",
        icon: Trophy,
        description: "Quem mais vende dentro do Shoppfy",
      },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    items: [
      {
        label: "Produtos",
        to: "/produtos",
        icon: Package,
        description: "Base de produtos monitorados",
      },
      {
        label: "Favoritos",
        to: "/favoritos",
        icon: Heart,
        description: "Produtos salvos por você",
      },
      {
        label: "Criar Anúncio",
        to: "/criar-anuncio",
        icon: Store,
        description: "Venda como lojista, sem precisar ser afiliado",
        badge: "Novo",
      },
      {
        label: "Pedidos",
        to: "/pedidos",
        icon: Receipt,
        description: "Produto, custo, etiqueta e comprovante do PIX de cada venda",
        badge: "Novo",
      },
    ],
  },
  {
    id: "divulgacao",
    label: "Divulgação",
    items: [
      {
        label: "Grupos de Divulgação",
        to: "/grupos-divulgacao",
        icon: Facebook,
        description: "WhatsApp e Facebook por nicho + post pronto pra colar",
      },
      {
        label: "Meus Links",
        to: "/meus-links",
        icon: Link2,
        description: "Todos os links de afiliado que você já gerou",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        label: "Pedidos (Admin)",
        to: "/pedidos-admin",
        icon: ShieldCheck,
        description: "Todos os pedidos enviados pelos revendedores, com dados de contato",
        ownerOnly: true,
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        label: "IA",
        to: "/ia",
        icon: Sparkles,
        description: "Geração de conteúdo e insights",
        badge: "Beta",
      },
      {
        label: "Editor de Vídeo",
        to: "/editor-video",
        icon: Clapperboard,
        description: "Corte e legende seu vídeo direto no navegador",
      },
      {
        label: "Integrações",
        to: "/integracoes",
        icon: Plug,
        description: "APIs, webhooks e automações",
      },
      {
        label: "Configurações",
        to: "/configuracoes",
        icon: Settings,
        description: "Conta, plano e preferências",
      },
    ],
  },
];

export const flatNavigation: NavItem[] = navigation.flatMap((g) => g.items);

// Remove itens `ownerOnly` pra quem não é o dono, e descarta grupos que
// ficarem vazios depois do filtro (ex: o grupo "Admin").
export function getNavigationForUser(isOwner: boolean): NavGroup[] {
  if (isOwner) return navigation;
  return navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.ownerOnly) }))
    .filter((group) => group.items.length > 0);
}
