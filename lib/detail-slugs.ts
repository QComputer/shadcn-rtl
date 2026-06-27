const DEFAULT_DETAIL_SLUG = "item";
const MAX_SLUG_LENGTH = 100;

export function normalizeDetailSlug(value: string | null | undefined, fallback = DEFAULT_DETAIL_SLUG) {
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

export async function buildUniqueDetailSlug(
  source: string,
  isTaken: (candidate: string) => Promise<boolean>,
) {
  const base = normalizeDetailSlug(source);
  let candidate = base;
  let suffix = 2;

  while (await isTaken(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}
