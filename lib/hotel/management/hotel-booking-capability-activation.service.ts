import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import prisma from "@/lib/db";

export class HotelBookingCapabilityActivationError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "HotelBookingCapabilityActivationError"; }
}

/** Additively enables only HOTEL_BOOKING for a confirmed Hotel organization/property. */
export async function activateHotelBookingCapability(input: {
  actorUserId: string;
  organizationId: string;
  expectedOrganizationSlug: string;
  expectedPropertyId: string;
}, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findFirst({ where: { id: input.actorUserId, role: "SUPER_ADMIN", isActive: true, deletedAt: null }, select: { id: true } });
    if (!actor) throw new HotelBookingCapabilityActivationError(403, "Active platform SUPER_ADMIN required");

    const organizations = await tx.$queryRaw<Array<{ id: string; slug: string; vertical: string | null; isActive: boolean; deletedAt: Date | null }>>`
      SELECT id, slug, vertical, "isActive", "deletedAt" FROM "Organization" WHERE id = ${input.organizationId} FOR UPDATE`;
    const organization = organizations[0];
    if (!organization || !organization.isActive || organization.deletedAt || organization.vertical !== "HOTEL" || organization.slug !== input.expectedOrganizationSlug) {
      throw new HotelBookingCapabilityActivationError(409, "Confirmed active Hotel organization not found");
    }
    const property = await tx.hotelProperty.findFirst({ where: { id: input.expectedPropertyId, organizationId: organization.id, isActive: true, deletedAt: null }, select: { id: true } });
    if (!property) throw new HotelBookingCapabilityActivationError(409, "Confirmed active Hotel property not found");

    const previous = await tx.organizationCapability.findUnique({ where: { organizationId_key: { organizationId: organization.id, key: "HOTEL_BOOKING" } } });
    if (previous?.status === "ACTIVE" && previous.enabledAt && !previous.disabledAt) {
      return { organizationId: organization.id, capabilityId: previous.id, status: previous.status, enabledAt: previous.enabledAt, disabledAt: null, changed: false, auditId: null };
    }
    const enabledAt = new Date();
    const capability = await tx.organizationCapability.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: "HOTEL_BOOKING" } },
      create: { organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt, disabledAt: null },
      update: { status: "ACTIVE", enabledAt, disabledAt: null },
    });
    const audit = await tx.auditLog.create({ data: {
      action: "UPDATE", entityType: "OrganizationCapability", entityId: capability.id,
      userId: actor.id, organizationId: organization.id, organizationSlug: organization.slug,
      description: "Additively activated HOTEL_BOOKING for verified Hotel organization",
      previousValue: previous ? { key: previous.key, status: previous.status, enabledAt: previous.enabledAt?.toISOString() ?? null, disabledAt: previous.disabledAt?.toISOString() ?? null } : { key: "HOTEL_BOOKING", exists: false },
      newValue: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: enabledAt.toISOString(), disabledAt: null, propertyId: property.id },
    } });
    return { organizationId: organization.id, capabilityId: capability.id, status: capability.status, enabledAt: capability.enabledAt, disabledAt: capability.disabledAt, changed: true, auditId: audit.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}
