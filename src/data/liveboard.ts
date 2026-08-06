// Dados de demonstração da réplica do "Monitor de vendas ao vivo" da Shopee.
// Trocar por dados reais (Seller Center / analytics_daily) quando a ingestão
// de vendas estiver ligada.

export const LIVEBOARD_TOTAL_CENTS = 164033;

export const LIVEBOARD_METRICS = [
  { label: "Visitantes", value: "559" },
  { label: "Cliques Por Produto", value: "394" },
  { label: "Pedidos", value: "27" },
  { label: "Unidades", value: "30" },
  { label: "Compradores", value: "27" },
  { label: "Taxa de Conversão", value: "6,85%" },
];

export type LiveboardPoint = { hour: string; today: number | null; yesterday: number };

export const LIVEBOARD_SERIES: LiveboardPoint[] = [
  { hour: "00", today: 0, yesterday: 0 },
  { hour: "01", today: 0, yesterday: 12 },
  { hour: "02", today: 0, yesterday: 30 },
  { hour: "03", today: 152, yesterday: 18 },
  { hour: "04", today: 0, yesterday: 0 },
  { hour: "05", today: 0, yesterday: 0 },
  { hour: "06", today: 0, yesterday: 0 },
  { hour: "07", today: 62, yesterday: 96 },
  { hour: "08", today: 186, yesterday: 44 },
  { hour: "09", today: 120, yesterday: 108 },
  { hour: "10", today: 96, yesterday: 132 },
  { hour: "11", today: 243, yesterday: 118 },
  { hour: "12", today: 74, yesterday: 96 },
  { hour: "13", today: 72, yesterday: 88 },
  { hour: "14", today: 118, yesterday: 74 },
  { hour: "15", today: 168, yesterday: 62 },
  { hour: "16", today: 60, yesterday: 58 },
  { hour: "17", today: 58, yesterday: 66 },
  { hour: "18", today: 84, yesterday: 78 },
  { hour: "19", today: 132, yesterday: 104 },
  { hour: "20", today: 190, yesterday: 152 },
  { hour: "21", today: null, yesterday: 96 },
  { hour: "22", today: null, yesterday: 24 },
];

export type LiveboardProduct = {
  id: string;
  title: string;
  image: string;
  units: number;
  revenueCents: number;
};

export const LIVEBOARD_TOP_PRODUCTS: LiveboardProduct[] = [
  {
    id: "lb-1",
    title: "25 Unidades de Seringa 60ml Sem Agulha Bico Cateter",
    image:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=160&q=70",
    units: 9,
    revenueCents: 48990,
  },
  {
    id: "lb-2",
    title: "50 Unidades De Seringas 1ml 100UI Seringa Insulina",
    image:
      "https://images.unsplash.com/photo-1615486364099-2f0a2b4a1b1f?auto=format&fit=crop&w=160&q=70",
    units: 7,
    revenueCents: 39120,
  },
  {
    id: "lb-3",
    title: "Kit 30un Frascos Nutrição Enteral 300ml",
    image:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=160&q=70",
    units: 5,
    revenueCents: 31450,
  },
  {
    id: "lb-4",
    title: "50 Unidade De Seringa Insulina 1ml Agulha Fixa",
    image:
      "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=160&q=70",
    units: 4,
    revenueCents: 22380,
  },
  {
    id: "lb-5",
    title: "Kit 10 Seringas 60ml Bico Cateter Sem Agulha",
    image:
      "https://images.unsplash.com/photo-1576671081837-49000212a370?auto=format&fit=crop&w=160&q=70",
    units: 2,
    revenueCents: 12100,
  },
];