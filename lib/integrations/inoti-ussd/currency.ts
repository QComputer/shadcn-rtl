const MAX_PROVIDER_AMOUNT_RIAL = BigInt("999999999999999999");
const RIAL_PER_TOMAN = BigInt(10);
const MAX_INTERNAL_AMOUNT_TOMAN = MAX_PROVIDER_AMOUNT_RIAL / RIAL_PER_TOMAN;

export function parsePositiveToman(value: string | number | bigint): bigint {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) throw new Error("INVALID_TOMAN_AMOUNT");
  const amount = BigInt(normalized);
  if (amount <= BigInt(0) || amount > MAX_INTERNAL_AMOUNT_TOMAN) {
    throw new Error("INVALID_TOMAN_AMOUNT");
  }
  return amount;
}

export function tomanToInotiRial(value: string | number | bigint): bigint {
  return parsePositiveToman(value) * RIAL_PER_TOMAN;
}

export function tomanDecimalToRial(value: string): bigint {
  return tomanToInotiRial(value);
}
