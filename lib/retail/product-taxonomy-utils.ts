/**
 * Pure helpers for additive Retail H2 product taxonomy.
 * No tenant lookup, database writes, or client trust in this module.
 */
export const MAX_PRODUCT_CATEGORIES = 20;
export const MAX_PRODUCT_TAGS = 30;
export const MAX_TAG_NAME_LENGTH = 64;

/** Preserve a readable display name while collapsing accidental whitespace. */
export function normalizeTagDisplayName(input: string): string {
  return input.normalize("NFC")
    .replace(/[\u064a\u0649]/g, "ی")
    .replace(/\u0643/g, "ک")
    .replace(/[\s\u200c]+/gu, " ")
    .trim();
}

export function tagIdentityKey(input: string): string {
  return normalizeTagDisplayName(input).toLocaleLowerCase("fa-IR");
}

export function canonicalTagNames(names: readonly string[]): Array<{ name: string; normalizedName: string }> {
  if (names.length > MAX_PRODUCT_TAGS) throw new Error("Too many tags");
  const seen = new Set<string>();
  const result: Array<{ name: string; normalizedName: string }> = [];
  for (const raw of names) {
    if (typeof raw !== "string") throw new Error("Invalid tag name");
    const name = normalizeTagDisplayName(raw);
    if (!name || name.length > MAX_TAG_NAME_LENGTH) throw new Error("Invalid tag name length");
    const normalizedName = tagIdentityKey(name);
    if (!seen.has(normalizedName)) {
      seen.add(normalizedName);
      result.push({ name, normalizedName });
    }
  }
  return result;
}

/** Primary is always retained, even when a client submits an empty selection. */
export function canonicalCategoryIds(primaryCategoryId: string, selectedIds: readonly string[]): string[] {
  if (!primaryCategoryId) throw new Error("Primary category required");
  if (selectedIds.length > MAX_PRODUCT_CATEGORIES) throw new Error("Too many categories");
  const categories = new Set([primaryCategoryId]);
  for (const id of selectedIds) {
    if (typeof id !== "string" || !id.trim()) throw new Error("Invalid category id");
    categories.add(id);
  }
  if (categories.size > MAX_PRODUCT_CATEGORIES) throw new Error("Too many categories");
  return Array.from(categories);
}
