import "server-only";
import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { DAMOON_DEMO_BOOKING, isDamoonDemoBookingRequest } from "@/lib/hotel/services/damoon-demo-booking";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

/** Resolve only the separately provisioned synthetic property; never fall back to Damoon's live property. */
export async function resolveDamoonDemoProperty(host: string | null | undefined, propertySlug: string, db: PrismaClient = prisma) {
  if (propertySlug !== DAMOON_DEMO_BOOKING.propertySlug || !(DAMOON_DEMO_BOOKING.hosts as readonly string[]).includes(normalizeDomainHost(host))) return null;
  const tenant = await resolveHotelTenantForHost(host, db);
  if (!tenant) return null;
  const [organization, property] = await Promise.all([
    db.organization.findFirst({ where: { id: tenant.organizationId, vertical: "HOTEL", isActive: true, deletedAt: null }, select: { id: true, slug: true } }),
    db.hotelProperty.findFirst({ where: { organizationId: tenant.organizationId, slug: DAMOON_DEMO_BOOKING.propertySlug, isActive: true, deletedAt: null }, select: { id: true, organizationId: true, slug: true, currency: true } }),
  ]);
  if (!organization || !property || property.organizationId !== organization.id || !isDamoonDemoBookingRequest({ host, organizationSlug: organization.slug, propertySlug })) return null;
  return { organizationId: organization.id, propertyId: property.id, propertySlug: property.slug, currency: property.currency };
}
