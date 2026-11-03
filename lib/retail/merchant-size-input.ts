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
