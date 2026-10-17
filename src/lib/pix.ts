// Gera o payload Pix (BR Code / EMV) direto no navegador — sem backend, sem
// serviço externo. Isso importa porque um gerador de QR code de terceiro
// receberia a chave Pix e o valor da transação; gerando local, esses dados
// nunca saem do dispositivo de quem tá pagando.
//
// Referência: manual de padrões do BR Code (Banco Central / arranjo Pix).
// Formato: TLV (tag-length-value) encadeado, fechado com CRC16-CCITT.

export type PixKeyType = "celular" | "cpf";

export type PixKeyConfig = {
  id: "principal" | "reserva";
  label: string;
  type: PixKeyType;
  key: string;
  note?: string;
};

// Nome/cidade do recebedor no payload — genéricos de propósito: o app só
// precisa disso pra montar o BR Code, ninguém vê isso como texto na tela do
// revendedor. (Vale lembrar: o banco de quem paga sempre mostra o nome
// cadastrado na chave Pix na hora de confirmar — isso é uma trava
// antifraude do próprio Pix, nenhum app consegue esconder isso.)
const MERCHANT_NAME = "SHOPPFY";
const MERCHANT_CITY = "SAO PAULO";

// 17/10/2026: a pedido do Jp, a chave principal passou a ser o CPF (conta
// Inter) e a chave celular (Santander) saiu. Fica só uma chave — sem
// "reserva". Alguns bancos mostram aviso de "possível golpe" pra chave CPF;
// é comportamento do app do banco, não problema real, por isso o aviso
// aparece logo abaixo do QR code.
export const PIX_KEYS: PixKeyConfig[] = [
  {
    id: "principal",
    label: "Chave Pix principal",
    type: "cpf",
    key: "52140528808",
    note: "Alguns bancos mostram um aviso de possível fraude com chave CPF — é normal, pode confirmar o pagamento.",
  },
];

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeKey(config: PixKeyConfig): string {
  const digits = config.key.replace(/\D/g, "");
  return config.type === "celular" ? `+55${digits}` : digits;
}

export function buildPixPayload(config: PixKeyConfig, amountCents: number): string {
  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", normalizeKey(config));
  const amount = Math.max(0, amountCents / 100).toFixed(2);
  const additionalData = tlv("05", "***");

  const withoutCrc =
    tlv("00", "01") +
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", MERCHANT_NAME) +
    tlv("60", MERCHANT_CITY) +
    tlv("62", additionalData) +
    "6304";

  return withoutCrc + crc16(withoutCrc);
}
