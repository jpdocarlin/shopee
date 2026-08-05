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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  shortcut?: string;
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
