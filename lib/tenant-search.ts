export function normalizeTenantSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200d]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchesTenantSearch(query: string, ...content: Array<string | null | undefined>) {
  const haystack = normalizeTenantSearch(content.filter(Boolean).join(" "));
  return normalizeTenantSearch(query).split(" ").every(token => haystack.includes(token));
}
