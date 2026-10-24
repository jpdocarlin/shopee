// Número de homologação ANATEL usado em TODOS os anúncios que pedem esse
// campo (Shopee "Registration ID" / Mercado Livre "Número de homologação
// Anatel"). 24/10/2026: o Jp pediu e as duas plataformas autorizaram, por
// mensagem, usar um único número pra todos os produtos anunciados pelo
// Shoppfy. Pra trocar o número, é só mudar aqui.
export const ANATEL_HOMOLOGATION_NUMBER = "172825672538";

// Nome/id do atributo que é o número ANATEL em cada marketplace.
export const ANATEL_ATTRIBUTE = /anatel|homologa|registration\s*id/i;
