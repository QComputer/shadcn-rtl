import { prisma } from "@/lib/db-runtime";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { resolveGuestPortalPropertyId } from "@/lib/hotel/services/guest-portal-discovery";

const disabled = () => Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") return disabled();

  const rawHost = request.headers.get("host");
  const normalizedDomain = normalizeDomainHost(rawHost);
  if (!normalizedDomain) return disabled();

  try {
    const tenant = await resolveHotelTenantForHost(rawHost);
    if (!tenant) return disabled();

    const capability = await prisma.organizationCapability.findFirst({
      where: { organizationId: tenant.organizationId, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null }, disabledAt: null },
      select: { id: true },
    });
    if (!capability) return disabled();

    const domain = await prisma.organizationDomain.findUnique({
      where: { normalizedDomain },
      select: {
        organizationId: true,
        status: true,
        providerVerified: true,
        verifiedAt: true,
        deletedAt: true,
        disabledAt: true,
        removedAt: true,
      },
    });
    if (!domain || domain.organizationId !== tenant.organizationId || domain.status !== "ACTIVE" ||
      !domain.providerVerified || !domain.verifiedAt || domain.verifiedAt > new Date() ||
      domain.deletedAt || domain.disabledAt || domain.removedAt) return disabled();

    const organization = await prisma.organization.findFirst({
      where: { id: tenant.organizationId, vertical: "HOTEL", isActive: true, deletedAt: null },
      select: { slug: true },
    });
    if (!organization) return disabled();

    const properties = await prisma.hotelProperty.findMany({
      where: {
        organizationId: tenant.organizationId,
        isActive: true,
        deletedAt: null,
        operationalMode: { not: "DISABLED" },
      },
      select: { id: true, slug: true },
      orderBy: { id: "asc" },
    });
    const propertyId = resolveGuestPortalPropertyId(organization.slug, properties);
    if (!propertyId) return disabled();

    return Response.json({ enabled: true, organizationId: tenant.organizationId, propertyId }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return disabled();
  }
}
