const DEFAULT_CATEGORY_SLUG = "category";
const MAX_SLUG_LENGTH = 80;

export function normalizeCategorySlug(value: string | null | undefined, fallback = DEFAULT_CATEGORY_SLUG) {
  const normalized = (value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, "-")
    .replace(/['’]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return normalized || fallback;
}

export async function buildUniqueCategorySlug(
  source: string,
  isTaken: (candidate: string) => Promise<boolean>,
) {
  const base = normalizeCategorySlug(source);
  let candidate = base;
  let suffix = 2;

  while (await isTaken(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}
