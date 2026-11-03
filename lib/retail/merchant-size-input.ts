import { normalizeRetailDigits } from "./product-detail";

/** Canonical option values; display localization stays separate. */
export function parseRetailOptionList(value: string, sizes = false): string[] {
  return [...new Set(value.split(/[,،;\n\r]+/).map(part => {
    const text = part.trim();
    return sizes ? normalizeRetailDigits(text).replace(/٫/g, ".") : text;
  }).filter(Boolean))];
}

export function retailNumericInput(value: string) {
  return normalizeRetailDigits(value).replace(/٫/g, ".");
}

/** Ignore unrelated legacy/test definitions when this product has its own option values. */
export function findRetailOptionDefinition<T extends { id: string; key: string; label: string }>(
  definitions: readonly T[], variants: ReadonlyArray<{ options: Record<string, string> }>, kind: "color" | "size",
): T | undefined {
  const pattern = kind === "color" ? /colou?r|رنگ|لون/i : /size|سایز|اندازه|مقاس/i;
  const candidates = definitions.filter(definition => pattern.test(`${definition.key} ${definition.label}`));
  const represented = candidates.filter(definition => variants.some(variant => Boolean(variant.options[definition.id])));
  const preferredKeys = kind === "color" ? ["shoe_color", "color", "clothing_color"] : ["shoe_size", "size", "clothing_size"];
  const choices = represented.length ? represented : candidates;
  return choices.find(definition => preferredKeys.includes(definition.key)) ?? choices[0];
}
