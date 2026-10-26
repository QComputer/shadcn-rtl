export type LegacyProductRouteCandidate = {
  id: string;
  slug: string | null;
  organizationSlug: string;
};

const supportedLocales = new Set(["fa", "en", "ar"]);

/**
 * Resolves old tenant-less product URLs only when the product identifier is
 * unambiguous across active public shops. Ambiguous identifiers fail closed.
 */
export function resolveLegacyProductRedirect(
  locale: string,
  candidates: readonly LegacyProductRouteCandidate[],
): string | null {
  if (!supportedLocales.has(locale) || candidates.length !== 1) return null;

  const [candidate] = candidates;
  const productSegment = candidate.slug || candidate.id;
  if (!candidate.organizationSlug || !productSegment) return null;

  return `/${encodeURIComponent(locale)}/${encodeURIComponent(candidate.organizationSlug)}/shop/product/${encodeURIComponent(productSegment)}`;
}
