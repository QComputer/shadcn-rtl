const MAX_PROVIDER_AMOUNT_RIAL = BigInt("999999999999999999");

export function tomanDecimalToRial(value: string): bigint {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error("INVALID_TOMAN_AMOUNT");

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  const scale = BigInt(10) ** BigInt(fraction.length);
  const coefficient = BigInt(`${whole}${fraction}`);
  const scaledRial = coefficient * BigInt(10);
  if (scaledRial % scale !== BigInt(0)) throw new Error("NON_INTEGER_RIAL_AMOUNT");

  const rial = scaledRial / scale;
  if (rial <= BigInt(0) || rial > MAX_PROVIDER_AMOUNT_RIAL) throw new Error("INVALID_RIAL_AMOUNT");
  return rial;
}
