import type { DashboardPeriod } from "@/data/demo-dashboard";

// Dados de demonstração — mesmo padrão de src/data/demo-dashboard.ts.
// Troca por dados reais (Supabase: agregação de sales por afiliado) assim que
// o ranking passar a ser calculado no backend a partir das vendas de todos os
// usuários do sistema.

export type RankingSeller = {
  id: string;
  name: string;
  topCategory: string;
  sales: Record<DashboardPeriod, number>;
  revenueCents: Record<DashboardPeriod, number>;
};

export const OTHER_SELLERS: RankingSeller[] = [
  {
    id: "seller-1",
    name: "Mariana Silva",
    topCategory: "Beleza",
    sales: { today: 5, "7d": 18, "30d": 62 },
    revenueCents: { today: 24000, "7d": 86400, "30d": 297600 },
  },
  {
    id: "seller-2",
    name: "Lucas Almeida",
    topCategory: "Eletrônicos",
    sales: { today: 4, "7d": 15, "30d": 54 },
    revenueCents: { today: 20800, "7d": 78000, "30d": 280800 },
  },
  {
    id: "seller-3",
    name: "Fernanda Costa",
    topCategory: "Moda",
    sales: { today: 3, "7d": 13, "30d": 49 },
    revenueCents: { today: 11700, "7d": 50700, "30d": 191100 },
  },
  {
    id: "seller-4",
    name: "Rafael Souza",
    topCategory: "Casa e Cozinha",
    sales: { today: 3, "7d": 11, "30d": 41 },
    revenueCents: { today: 13500, "7d": 49500, "30d": 184500 },
  },
  {
    id: "seller-5",
    name: "Juliana Pereira",
    topCategory: "Saúde",
    sales: { today: 2, "7d": 9, "30d": 35 },
    revenueCents: { today: 11200, "7d": 50400, "30d": 196000 },
  },
  {
    id: "seller-6",
    name: "Bruno Oliveira",
    topCategory: "Games",
    sales: { today: 2, "7d": 8, "30d": 29 },
    revenueCents: { today: 7200, "7d": 28800, "30d": 104400 },
  },
  {
    id: "seller-7",
    name: "Camila Rodrigues",
    topCategory: "Beleza",
    sales: { today: 2, "7d": 6, "30d": 24 },
    revenueCents: { today: 8200, "7d": 24600, "30d": 98400 },
  },
  {
    id: "seller-8",
    name: "Thiago Santos",
    topCategory: "Escritório",
    sales: { today: 1, "7d": 5, "30d": 19 },
    revenueCents: { today: 4700, "7d": 23500, "30d": 89300 },
  },
  {
    id: "seller-9",
    name: "Larissa Lima",
    topCategory: "Casa e Cozinha",
    sales: { today: 1, "7d": 4, "30d": 15 },
    revenueCents: { today: 3800, "7d": 15200, "30d": 57000 },
  },
  {
    id: "seller-10",
    name: "Pedro Henrique",
    topCategory: "Moda",
    sales: { today: 1, "7d": 3, "30d": 13 },
    revenueCents: { today: 5000, "7d": 15000, "30d": 65000 },
  },
  {
    id: "seller-11",
    name: "Amanda Ferreira",
    topCategory: "Eletrônicos",
    sales: { today: 0, "7d": 2, "30d": 9 },
    revenueCents: { today: 0, "7d": 8400, "30d": 37800 },
  },
  {
    id: "seller-12",
    name: "Gabriel Martins",
    topCategory: "Saúde",
    sales: { today: 0, "7d": 1, "30d": 6 },
    revenueCents: { today: 0, "7d": 3500, "30d": 21000 },
  },
];
