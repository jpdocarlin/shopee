export type GroupPlatform = "facebook";
export type NicheGroup = {
  id: string;
  name: string;
  platform: GroupPlatform;
  url: string;
};
export type NicheEntry = {
  id: string;
  label: string;
  groups: NicheGroup[];
};
/**
 * Diretório curado manualmente com grupos reais do Facebook por nicho —
 * não existe API do Facebook pra buscar ou postar em grupo automaticamente
 * (a Meta descontinuou o Groups API em abril de 2024). Os grupos com ID
 * puramente numérico não expõem nome público sem entrar no grupo primeiro
 * (Facebook não mostra isso fora de sessão logada); nesses casos o nome
 * usado aqui é genérico ("Grupo de {nicho} #N") até alguém confirmar o
 * nome real. Grupos com URL "de vanidade" (ex: belezafemininabrasil) usam
 * o nome derivado do próprio endereço.
 */
export const NICHES: NicheEntry[] = [
  {
    id: "beleza",
    label: "Beleza",
    groups: [
      {
        id: "beleza-1",
        name: "Beleza Feminina Brasil",
        platform: "facebook",
        url: "https://www.facebook.com/groups/belezafemininabrasil",
      },
      {
        id: "beleza-2",
        name: "Grupo de Beleza #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/921881528643165",
      },
      {
        id: "beleza-3",
        name: "Grupo de Beleza #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/331471377515073",
      },
      {
        id: "beleza-4",
        name: "Grupo de Beleza #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1419522899802028",
      },
      {
        id: "beleza-5",
        name: "Grupo de Beleza #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/177963132548143",
      },
      {
        id: "beleza-6",
        name: "Grupo de Beleza #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/623382661875104",
      },
      {
        id: "beleza-7",
        name: "Grupo de Beleza #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/670063119696421",
      },
      {
        id: "beleza-8",
        name: "Grupo de Beleza #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/3898722073543310",
      },
      {
        id: "beleza-9",
        name: "Grupo de Beleza #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/679569562159944",
      },
      {
        id: "beleza-10",
        name: "Grupo de Beleza #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1194241781038238",
      },
    ],
  },
  {
    id: "moda",
    label: "Moda",
    groups: [
      {
        id: "moda-1",
        name: "Grupo de Moda #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/827327792002185",
      },
      {
        id: "moda-2",
        name: "Grupo de Moda #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/681899981349481",
      },
      {
        id: "moda-3",
        name: "Grupo de Moda #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1375783007606616",
      },
      {
        id: "moda-4",
        name: "Grupo de Moda #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/253825325474873",
      },
      {
        id: "moda-5",
        name: "Moda Feminina BR",
        platform: "facebook",
        url: "https://www.facebook.com/groups/modafemininabr",
      },
      {
        id: "moda-6",
        name: "Vivi Modas Online",
        platform: "facebook",
        url: "https://www.facebook.com/groups/vivimodasonline",
      },
      {
        id: "moda-7",
        name: "Grupo de Moda #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1576534275970810",
      },
      {
        id: "moda-8",
        name: "Grupo de Moda #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/501242519019988",
      },
      {
        id: "moda-9",
        name: "Grupo de Moda #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/227330959672142",
      },
      {
        id: "moda-10",
        name: "Grupo de Moda #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/573758720491826",
      },
    ],
  },
  {
    id: "casa-decoracao",
    label: "Casa e Decoração",
    groups: [
      {
        id: "casa-decoracao-1",
        name: "Grupo de Casa e Decoração #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/208983438678619",
      },
      {
        id: "casa-decoracao-2",
        name: "Grupo de Casa e Decoração #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1599021783732452",
      },
      {
        id: "casa-decoracao-3",
        name: "Grupo de Casa e Decoração #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/398455665427735",
      },
      {
        id: "casa-decoracao-4",
        name: "Grupo de Casa e Decoração #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/415989559755943",
      },
      {
        id: "casa-decoracao-5",
        name: "Grupo de Casa e Decoração #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1232365454674193",
      },
      {
        id: "casa-decoracao-6",
        name: "Grupo de Casa e Decoração #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/578470607178744",
      },
      {
        id: "casa-decoracao-7",
        name: "Grupo de Casa e Decoração #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/565070566926818",
      },
      {
        id: "casa-decoracao-8",
        name: "Grupo de Casa e Decoração #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/811021770682797",
      },
      {
        id: "casa-decoracao-9",
        name: "Grupo de Casa e Decoração #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/213054151267351",
      },
      {
        id: "casa-decoracao-10",
        name: "Grupo de Casa e Decoração #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/6220016801355867",
      },
    ],
  },
  {
    id: "eletronicos",
    label: "Eletrônicos",
    groups: [
      {
        id: "eletronicos-1",
        name: "Grupo de Eletrônicos #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1337532630735458",
      },
      {
        id: "eletronicos-2",
        name: "Grupo de Eletrônicos #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/219925263203149",
      },
      {
        id: "eletronicos-3",
        name: "Grupo de Eletrônicos #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/3340679119324653",
      },
      {
        id: "eletronicos-4",
        name: "Grupo de Eletrônicos #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1641251512757666",
      },
      {
        id: "eletronicos-5",
        name: "Brasil CVT",
        platform: "facebook",
        url: "https://www.facebook.com/groups/brasilcvt",
      },
      {
        id: "eletronicos-6",
        name: "Grupo de Eletrônicos #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/622312227962837",
      },
      {
        id: "eletronicos-7",
        name: "Grupo de Eletrônicos #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/240747336129821",
      },
      {
        id: "eletronicos-8",
        name: "Grupo de Eletrônicos #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1660850774162071",
      },
      {
        id: "eletronicos-9",
        name: "Grupo de Eletrônicos #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1859685680952047",
      },
      {
        id: "eletronicos-10",
        name: "Eletricidade",
        platform: "facebook",
        url: "https://www.facebook.com/groups/wa.eletricidade",
      },
    ],
  },
  {
    id: "pet",
    label: "Pet",
    groups: [
      {
        id: "pet-1",
        name: "Grupo de Pet #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/656579057804710",
      },
      {
        id: "pet-2",
        name: "Grupo de Pet #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/303218275173220",
      },
      {
        id: "pet-3",
        name: "Grupo de Pet #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/293846071059098",
      },
      {
        id: "pet-4",
        name: "Grupo de Pet #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/431626900275137",
      },
      {
        id: "pet-5",
        name: "Portal dos Pets",
        platform: "facebook",
        url: "https://www.facebook.com/groups/www.portaldospets",
      },
      {
        id: "pet-6",
        name: "Grupo de Pet #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/529255536847616",
      },
      {
        id: "pet-7",
        name: "Anima Pet",
        platform: "facebook",
        url: "https://www.facebook.com/groups/animapet",
      },
      {
        id: "pet-8",
        name: "Grupo de Pet #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/192587185534663",
      },
      {
        id: "pet-9",
        name: "Grupo de Pet #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/843759473195914",
      },
      {
        id: "pet-10",
        name: "Grupo de Pet #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/3414655255474076",
      },
    ],
  },
  {
    id: "automotivo",
    label: "Automotivo",
    groups: [
      {
        id: "automotivo-1",
        name: "Grupo de Automotivo #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/173936403171486",
      },
      {
        id: "automotivo-2",
        name: "Grupo de Automotivo #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1634048800041839",
      },
      {
        id: "automotivo-3",
        name: "Grupo de Automotivo #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/751469506356315",
      },
      {
        id: "automotivo-4",
        name: "Grupo de Automotivo #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1682357265481323",
      },
      {
        id: "automotivo-5",
        name: "Grupo de Automotivo #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/668548340000298",
      },
      {
        id: "automotivo-6",
        name: "Grupo de Automotivo #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1089789989099702",
      },
      {
        id: "automotivo-7",
        name: "Grupo de Automotivo #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/585188188259146",
      },
      {
        id: "automotivo-8",
        name: "Grupo de Automotivo #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1515106836031795",
      },
      {
        id: "automotivo-9",
        name: "Só Peças Veiculares",
        platform: "facebook",
        url: "https://www.facebook.com/groups/sopecasveiculares",
      },
      {
        id: "automotivo-10",
        name: "Grupo de Automotivo #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1035031070970423",
      },
    ],
  },
  {
    id: "fitness",
    label: "Fitness e Bem-estar",
    groups: [
      {
        id: "fitness-1",
        name: "Grupo de Fitness e Bem-estar #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/939988969766219",
      },
      {
        id: "fitness-2",
        name: "Grupo de Fitness e Bem-estar #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/258452300499795",
      },
      {
        id: "fitness-3",
        name: "Fitness Mulheres",
        platform: "facebook",
        url: "https://www.facebook.com/groups/fitnessmulheres",
      },
      {
        id: "fitness-4",
        name: "Grupo de Fitness e Bem-estar #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1243041577559316",
      },
      {
        id: "fitness-5",
        name: "Grupo de Fitness e Bem-estar #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/666399232351521",
      },
      {
        id: "fitness-6",
        name: "Grupo de Fitness e Bem-estar #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/542852019559104",
      },
      {
        id: "fitness-7",
        name: "Grupo de Fitness e Bem-estar #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/125551451579381",
      },
      {
        id: "fitness-8",
        name: "Grupo de Fitness e Bem-estar #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/426617357918666",
      },
      {
        id: "fitness-9",
        name: "Grupo de Fitness e Bem-estar #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1324557994288052",
      },
      {
        id: "fitness-10",
        name: "Grupo de Fitness e Bem-estar #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/431994078223713",
      },
    ],
  },
  {
    id: "cozinha",
    label: "Cozinha",
    groups: [
      {
        id: "cozinha-1",
        name: "Grupo de Cozinha #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/858754598865249",
      },
      {
        id: "cozinha-2",
        name: "Grupo de Cozinha #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1196519241286826",
      },
      {
        id: "cozinha-3",
        name: "Grupo de Cozinha #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1457017797931654",
      },
      {
        id: "cozinha-4",
        name: "Grupo de Cozinha #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/666069147109748",
      },
      {
        id: "cozinha-5",
        name: "Grupo de Cozinha #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/532271610298190",
      },
      {
        id: "cozinha-6",
        name: "Grupo de Cozinha #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/2900281493518358",
      },
      {
        id: "cozinha-7",
        name: "Grupo de Cozinha #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/382542395249638",
      },
      {
        id: "cozinha-8",
        name: "Grupo de Cozinha #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/215318021662644",
      },
      {
        id: "cozinha-9",
        name: "Grupo de Cozinha #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/726483208034033",
      },
      {
        id: "cozinha-10",
        name: "Grupo de Cozinha #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/532843630965669",
      },
    ],
  },
  {
    id: "games",
    label: "Games",
    groups: [
      {
        id: "games-1",
        name: "Grupo de Games #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/405309720436552",
      },
      {
        id: "games-2",
        name: "AdehGames",
        platform: "facebook",
        url: "https://www.facebook.com/groups/adehgames",
      },
      {
        id: "games-3",
        name: "Grupo de Games #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/531485134131463",
      },
      {
        id: "games-4",
        name: "Corinthi",
        platform: "facebook",
        url: "https://www.facebook.com/groups/Corinthi",
      },
      {
        id: "games-5",
        name: "Tudo Games",
        platform: "facebook",
        url: "https://www.facebook.com/groups/grupotudogames",
      },
      {
        id: "games-6",
        name: "Divulga Gamers Brasil",
        platform: "facebook",
        url: "https://www.facebook.com/groups/divulgagamersbrasil",
      },
      {
        id: "games-7",
        name: "Games Viciantes",
        platform: "facebook",
        url: "https://www.facebook.com/groups/gamesviciantes",
      },
      {
        id: "games-8",
        name: "Grupo de Games #8",
        platform: "facebook",
        url: "https://www.facebook.com/groups/626719004158973",
      },
      {
        id: "games-9",
        name: "Gamers Ofi Brasil",
        platform: "facebook",
        url: "https://www.facebook.com/groups/gamersofibrasil",
      },
      {
        id: "games-10",
        name: "Grupo de Games #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/3043143892678848",
      },
    ],
  },
  {
    id: "bebes",
    label: "Bebês e Infantil",
    groups: [
      {
        id: "bebes-1",
        name: "Grupo de Bebês e Infantil #1",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1761947627288887",
      },
      {
        id: "bebes-2",
        name: "Grupo de Bebês e Infantil #2",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1451235316501974",
      },
      {
        id: "bebes-3",
        name: "Grupo de Bebês e Infantil #3",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1451189308509750",
      },
      {
        id: "bebes-4",
        name: "Grupo de Bebês e Infantil #4",
        platform: "facebook",
        url: "https://www.facebook.com/groups/826188760796758",
      },
      {
        id: "bebes-5",
        name: "Grupo de Bebês e Infantil #5",
        platform: "facebook",
        url: "https://www.facebook.com/groups/109281839756086",
      },
      {
        id: "bebes-6",
        name: "Grupo de Bebês e Infantil #6",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1173929365965759",
      },
      {
        id: "bebes-7",
        name: "Grupo de Bebês e Infantil #7",
        platform: "facebook",
        url: "https://www.facebook.com/groups/2028256370767592",
      },
      {
        id: "bebes-8",
        name: "Desapego Menina SP",
        platform: "facebook",
        url: "https://www.facebook.com/groups/desapegomeninasp.1",
      },
      {
        id: "bebes-9",
        name: "Grupo de Bebês e Infantil #9",
        platform: "facebook",
        url: "https://www.facebook.com/groups/1820761034895211",
      },
      {
        id: "bebes-10",
        name: "Grupo de Bebês e Infantil #10",
        platform: "facebook",
        url: "https://www.facebook.com/groups/360228174315025",
      },
    ],
  },
];

export type GeneralGroup = {
  id: string;
  name: string;
  url: string;
  about: string;
};

/** Grupos genéricos de "achadinhos" do Facebook que aceitam qualquer nicho. */
export const GENERAL_GROUPS: GeneralGroup[] = [
  {
    id: "fb-1",
    name: "Achadinhos Shopee Brasil",
    url: "https://www.facebook.com/groups/3680749695377827",
    about: "Ofertas diárias de Shopee compartilhadas pelos próprios membros.",
  },
  {
    id: "fb-2",
    name: "Achadinhos Shopee & Mercado Livre",
    url: "https://www.facebook.com/groups/213274796470067",
    about: "Grupo misto Shopee + Mercado Livre, focado em promoções do dia.",
  },
  {
    id: "fb-3",
    name: "ACHADINHOS - DICAS - PROMOÇÕES",
    url: "https://www.facebook.com/groups/1464249347133770",
    about: "Comunidade geral de achadinhos e dicas de compra.",
  },
  {
    id: "fb-4",
    name: "Achadinhos da Shopee (divulgue seu link)",
    url: "https://www.facebook.com/groups/447491464490229",
    about: "Grupo explicitamente aberto pra afiliados divulgarem link próprio.",
  },
  {
    id: "fb-5",
    name: "Achadinhos Promo Ofertas",
    url: "https://www.facebook.com/groups/1206025820099046",
    about: "Ofertas e promoções de múltiplas lojas online.",
  },
  {
    id: "fb-6",
    name: "Achadinhos Shopee/Shein/Magalu/Amazon",
    url: "https://www.facebook.com/groups/457561646974153",
    about: "Multi-loja, com bastante circulação de moda e beleza.",
  },
];
