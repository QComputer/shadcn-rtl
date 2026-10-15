import "server-only";

import { prisma } from "@/lib/db-runtime";
import { resolveHotelWebsiteTenantForHost } from "@/lib/hotel/content/hotel-website-public.service";

export type HotelWebsiteFrontendContext =
  | Readonly<{ status: "READY"; propertySlug: string }>
  | Readonly<{ status: "UNAVAILABLE" }>;

/**
 * Resolves only a single-property organization from trusted request context.
 * The public API repeats tenant, capability and publication authorization;
 * this helper only provides a server-selected property slug to the UI.
 */
export async function resolveHotelWebsiteFrontendContext(input: {
  host: string | null;
  organizationId: string;
  organizationSlug?: string | null;
}): Promise<HotelWebsiteFrontendContext> {
  const tenant = await resolveHotelWebsiteTenantForHost(input.host, undefined, input.organizationSlug);
  if (!tenant || tenant.organizationId !== input.organizationId) return { status: "UNAVAILABLE" };

  const properties = await prisma.hotelProperty.findMany({
    where: { organizationId: tenant.organizationId, isActive: true, deletedAt: null },
    select: { slug: true },
    orderBy: { slug: "asc" },
    take: 2,
  });

  if (properties.length !== 1 || !properties[0]?.slug) return { status: "UNAVAILABLE" };
  return { status: "READY", propertySlug: properties[0].slug };
}
