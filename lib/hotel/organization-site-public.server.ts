import "server-only";

import { cache } from "react";
import { resolveHotelWebsiteFrontendContext } from "@/lib/hotel/website-frontend-context.server";
import { getPublishedHotelOrganizationSnapshot } from "@/lib/hotel/content/hotel-website-public.service";
import { adaptHotelOrganizationPublicRead, type HotelOrganizationSitePresentation } from "@/lib/hotel/organization-site-presentation";
import { isHotelWebsitePublicReadAvailable } from "@/lib/hotel/services/public-website-gate";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";

/** Request-local memoization only: metadata and render share an authorized
 * snapshot. Call only with the actual/proxy-validated host and DB-derived org.
 * No public preview switch, invented content, or cross-request content cache. */
export const readHotelOrganizationSite = cache(async (
  host: string | null, organizationId: string, organizationSlug: string,
  locale: HotelPublicLocale, customDomain: boolean,
): Promise<HotelOrganizationSitePresentation> => {
  const unavailable = (propertySlug: string, code: "UNAVAILABLE_PROPERTY" | "PUBLICATION_DISABLED" | "TEMPORARY_UNAVAILABLE"): HotelOrganizationSitePresentation => ({ status: "UNAVAILABLE", locale, propertySlug, code });
  if (!isHotelWebsitePublicReadAvailable()) return unavailable("", "PUBLICATION_DISABLED");
  try {
    const selector = customDomain ? null : organizationSlug;
    const context = await resolveHotelWebsiteFrontendContext({ host, organizationId, organizationSlug: selector });
    if (context.status !== "READY") return unavailable("", "UNAVAILABLE_PROPERTY");
    const snapshot = await getPublishedHotelOrganizationSnapshot({ host, expectedOrganizationId: organizationId, organizationSlug: selector, propertySlug: context.propertySlug, locale });
    if (!snapshot) return unavailable(context.propertySlug, "UNAVAILABLE_PROPERTY");
    // Editorial approval is not evidence of owner-approved provenance or SEO
    // consent. C1A has no such persisted contract, so indexing stays disabled.
    return adaptHotelOrganizationPublicRead(snapshot.website, snapshot.rooms, { organizationId, organizationSlug, propertySlug: context.propertySlug, locale, contentProvenance: "UNKNOWN" });
  } catch {
    return unavailable("", "TEMPORARY_UNAVAILABLE");
  }
});
