import { GENERAL_GROUPS, NICHES, type NicheGroup } from "@/data/demo-groups";

// Mapeia a categoria do produto (demo-products.ts) pro nicho de grupos
// (demo-groups.ts). Categoria sem mapeamento cai no fallback "Geral".
const CATEGORY_TO_NICHE: Record<string, string> = {
  Eletrônicos: "eletronicos",
  Moda: "moda",
  "Casa e Cozinha": "cozinha",
  Games: "games",
  Beleza: "beleza",
  Saúde: "fitness",
};

export type SuggestedGroups = {
  nicheId: string | null;
  nicheLabel: string;
  groups: NicheGroup[];
};

export function getSuggestedGroups(category: string, limit = 5): SuggestedGroups {
  const nicheId = CATEGORY_TO_NICHE[category];
  const niche = nicheId ? NICHES.find((n) => n.id === nicheId) : undefined;

  if (niche) {
    return { nicheId: niche.id, nicheLabel: niche.label, groups: niche.groups.slice(0, limit) };
  }

  return {
    nicheId: null,
    nicheLabel: "Geral",
    groups: GENERAL_GROUPS.slice(0, limit).map((g) => ({
      id: g.id,
      name: g.name,
      platform: "facebook" as const,
      url: g.url,
    })),
  };
}
