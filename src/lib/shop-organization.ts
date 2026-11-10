// Minha Loja → "Organizar minha loja": como os anúncios viram categorias da
// loja. Arquivo puro (sem servidor), usado pelo front pra montar a proposta.

export type OrganizationGroup = { name: string; externalIds: string[] };

const MIN_GROUP = 5;
const MAX_GROUPS = 20;
export const OTHERS = "Outros achados";

// Nomes curtos e claros pro comprador (a árvore da Shopee tem nomes longos).
const GROUP_NAMES: Record<string, string> = {
  "Eletrodomésticos / Peças e Circuitos Elétricos": "Tomadas e Elétrica",
  "Eletrodomésticos / Utensílios de Cozinha": "Eletroportáteis de Cozinha",
  "Eletrodomésticos / TVs e Acessórios": "TV e Streaming",
  "Eletrodomésticos / Eletrodomésticos Pequenos": "Eletroportáteis",
  "Eletrodomésticos / Eletrodomésticos Grandes": "Ventiladores e Clima",
  "Casa e Decoração / Artigos de Festa": "Festa e Natal",
  "Casa e Decoração / Artigos de Cozinha": "Cozinha",
  "Casa e Decoração / Artigos de Cuidados com a Casa": "Limpeza da Casa",
  "Casa e Decoração / Ferramentas e Melhorias para a Casa": "Ferramentas",
  "Casa e Decoração / Organizadores para Casa": "Organização",
  "Casa e Decoração / Decoração": "Decoração",
  "Casa e Decoração / Iluminação": "Iluminação",
  "Casa e Decoração / Banheiros": "Banheiro",
  "Casa e Decoração / Louça": "Mesa e Louça",
  "Casa e Decoração / Jardinagem": "Jardim",
  "Casa e Decoração / Segurança": "Segurança da Casa",
  "Celulares e Dispositivos / Acessórios": "Acessórios para Celular",
  "Celulares e Dispositivos / Aparelhos Vestíveis": "Smartwatches",
  "Áudio / Fones de Ouvido, Headphones e Headsets": "Fones de Ouvido",
  "Áudio / Áudio e Alto Falantes para Casa": "Caixas de Som",
  "Beleza / Cuidados Masculinos": "Barba e Cabelo",
  "Beleza / Utensílios de Beleza": "Beleza e Cuidados",
  "Mãe e Bebê / Brinquedos": "Brinquedos",
  "Mãe e Bebê / Essenciais para Alimentação": "Bebê",
  "Hobbies e Coleções / Brinquedos e Jogos": "Jogos e Brinquedos",
  "Papelaria / Equipamento Escolar e de Escritório": "Papelaria",
  "Câmeras e Drones / Câmeras e Sistemas de Segurança": "Câmeras de Segurança",
  "Computadores e Acessórios / Teclados e Mouses": "Teclados e Mouses",
  "Computadores e Acessórios": "Informática",
  "Celulares e Dispositivos": "Celulares e Acessórios",
  "Peças e Acessórios para Veículos": "Carro e Moto",
  "Esportes e Atividades ao Ar Livre": "Esporte e Lazer",
  "Mãe e Bebê": "Bebê e Infantil",
  "Moda Infantil": "Infantil",
  "Hobbies e Coleções": "Jogos e Hobbies",
  "Câmeras e Drones": "Câmeras",
  "Saúde": "Saúde e Bem-estar",
  "Casa e Decoração": "Casa e Decoração",
};

// Último pedaço do caminho que não diz nada sozinho.
const GENERIC = /^(outros|acess[oó]rios|diversos)$/i;

function friendlyName(key: string): string {
  const mapped = GROUP_NAMES[key];
  if (mapped) return mapped;
  const parts = key.split(" / ");
  const last = parts[parts.length - 1];
  if (GENERIC.test(last) && parts.length > 1) {
    return GROUP_NAMES[parts[0]] ?? parts[0];
  }
  return last;
}

export function buildGroups(items: Array<{ externalId: string; path: string }>): OrganizationGroup[] {
  const level = (path: string, depth: number) => path.split(" / ").slice(0, depth).join(" / ");
  const bucket = (key: (path: string) => string, list: typeof items) => {
    const map = new Map<string, string[]>();
    for (const item of list) {
      const k = key(item.path);
      map.set(k, [...(map.get(k) ?? []), item.externalId]);
    }
    return map;
  };

  // 1) Tenta pelo 2º nível; grupo pequeno sobe pro 1º nível; o que ainda
  //    ficar pequeno vai pra "Outros achados".
  const groups = new Map<string, string[]>();
  const leftovers: typeof items = [];
  const byId = new Map(items.map((i) => [i.externalId, i]));
  for (const [key, ids] of bucket((p) => level(p, 2), items)) {
    if (ids.length >= MIN_GROUP) groups.set(key, ids);
    else for (const id of ids) leftovers.push(byId.get(id)!);
  }
  const others: string[] = [];
  for (const [key, ids] of bucket((p) => level(p, 1), leftovers)) {
    if (ids.length >= MIN_GROUP) groups.set(key, [...(groups.get(key) ?? []), ...ids]);
    else others.push(...ids);
  }

  // 2) Nome amigável (grupos que caem no mesmo nome se juntam).
  const named = new Map<string, string[]>();
  for (const [key, ids] of groups) {
    const name = friendlyName(key).slice(0, 40);
    if (GENERIC.test(name)) others.push(...ids);
    else named.set(name, [...(named.get(name) ?? []), ...ids]);
  }

  // 3) No máximo MAX_GROUPS categorias; as menores vão pra "Outros achados".
  const sorted = [...named.entries()].sort((a, b) => b[1].length - a[1].length);
  const kept = sorted.slice(0, MAX_GROUPS - 1);
  for (const [, ids] of sorted.slice(MAX_GROUPS - 1)) others.push(...ids);
  const result = kept.map(([name, externalIds]) => ({ name, externalIds }));
  if (others.length > 0) result.push({ name: OTHERS, externalIds: others });
  return result;
}
