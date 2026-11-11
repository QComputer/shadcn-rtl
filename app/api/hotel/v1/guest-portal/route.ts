import { prisma } from "@/lib/db-runtime";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

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

    const properties = await prisma.hotelProperty.findMany({
      where: {
        organizationId: tenant.organizationId,
        isActive: true,
        deletedAt: null,
        operationalMode: { not: "DISABLED" },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (properties.length !== 1) return disabled();

    return Response.json({ enabled: true, organizationId: tenant.organizationId, propertyId: properties[0].id }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return disabled();
  }
}
