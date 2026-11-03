// Número de homologação ANATEL usado em TODOS os anúncios que pedem esse
// campo (Shopee "Registration ID" / Mercado Livre "Número de homologação
// Anatel"). 24/10/2026: o Jp pediu e as duas plataformas autorizaram, por
// mensagem, usar um único número pra todos os produtos anunciados pelo
// Shoppfy. Pra trocar o número, é só mudar aqui.
export const ANATEL_HOMOLOGATION_NUMBER = "172825672538";

// Nome/id do atributo que é o número ANATEL em cada marketplace.
export const ANATEL_ATTRIBUTE = /anatel|homologa|registration\s*id/i;

// 03/11/2026: a Shopee criou (anúncio OpenAPI 1586, obrigatório desde
// 20/10/2026) o atributo "Contém Bluetooth, Wi-Fi ou tecnologia de
// radiofrequência (RF)?" (Sim/Não). Se a resposta for "Sim", o atributo filho
// "Número de licença Anatel" vira obrigatório e a Shopee valida o número
// contra o produto. Responder "Sim" pra um enfeite de Natal fazia a Shopee
// recusar o anúncio por causa do ANATEL. Agora a resposta depende do produto.
export const RF_PARENT_ATTRIBUTE =
  /(cont[eé]m|contains|possui|has)\b.*(bluetooth|wi-?fi|radiofrequ|radio\s*frequ|\brf\b)/i;

// Produto que de fato tem Bluetooth / Wi-Fi / rádio (pelo título).
const RADIO_PRODUCT =
  /bluetooth|wi-?fi|wireless|sem fio|\btws\b|smart\s*-?\s*watch|rel[oó]gio inteligente|smartband|r[aá]dio\b|walkie|drone|controle remoto|airpods?|caixa de som|roteador|repetidor|chromecast|tv\s*box|smart\s*tv|alexa|echo dot|l[aâ]mpada inteligente|tomada inteligente|c[aâ]mera\s*(ip|wi|espi)|baba eletr[oô]nica|fone\s*(sem|bt|bluetooth)|headset\s*(sem|bt|bluetooth|gamer sem)|gps\b|rastreador|celular|smartphone|tablet|modem|\bnfc\b/i;

export function productHasRadio(text: string): boolean {
  return RADIO_PRODUCT.test(text ?? "");
}

const YES = /^\s*(sim|yes)\b/i;
const NO = /^\s*(n[aã]o|no)\b/i;

export function pickYesNo<T extends { name?: string }>(values: T[], yes: boolean): T | undefined {
  return values.find((v) => (yes ? YES : NO).test(v.name ?? ""));
}
