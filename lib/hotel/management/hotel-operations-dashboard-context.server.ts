import "server-only";

import type { UserRole } from "@prisma/client";
import prisma from "@/lib/db";

export type HotelOperationsProperty = { id: string; name: string; slug: string; timezone: string };
export type HotelOperationsOrganization = {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MANAGER" | "SUPER_ADMIN";
  properties: HotelOperationsProperty[];
};

/** Re-read authority from current rows; requested identifiers never grant access. */
export async function listHotelOperationsOrganizations(input: {
  userId: string;
  sessionOrganizationId?: string | null;
  sessionRole: UserRole;
  requestedOrganizationId?: string | null;
}): Promise<HotelOperationsOrganization[]> {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user || user.role !== input.sessionRole || !["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(user.role)) return [];

  const platformAdmin = user.role === "SUPER_ADMIN";
  if (input.sessionRole === "SUPER_ADMIN" && !platformAdmin) return [];

  let organizationIds: string[];
  const organizationRoles = new Map<string, "ADMIN" | "MANAGER">();
  if (platformAdmin) {
    organizationIds = input.requestedOrganizationId
      ? [input.requestedOrganizationId]
      : (await prisma.organization.findMany({
          where: {
            vertical: "HOTEL",
            isActive: true,
            deletedAt: null,
            capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } },
          },
          select: { id: true },
        })).map((organization) => organization.id);
  } else {
    const organizationId = input.sessionOrganizationId;
    if (!organizationId || (input.requestedOrganizationId && input.requestedOrganizationId !== organizationId)) return [];
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: input.userId,
        organizationId,
        isActive: true,
        role: { in: ["ADMIN", "MANAGER"] },
        organization: {
          vertical: "HOTEL",
          isActive: true,
          deletedAt: null,
          capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } },
        },
      },
      select: { organizationId: true, role: true },
    });
    if (!membership) return [];
    organizationIds = [membership.organizationId];
    organizationRoles.set(membership.organizationId, membership.role as "ADMIN" | "MANAGER");
  }

  if (organizationIds.length === 0) return [];
  const organizations = await prisma.organization.findMany({
    where: {
      id: { in: organizationIds },
      vertical: "HOTEL",
      isActive: true,
      deletedAt: null,
      capabilities: { some: { key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: { not: null } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      hotelProperties: {
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, timezone: true },
      },
    },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: platformAdmin ? "SUPER_ADMIN" : organizationRoles.get(organization.id) ?? "MANAGER",
    properties: organization.hotelProperties,
  }));
}

export async function getHotelOperationsOrganization(input: {
  userId: string;
  sessionOrganizationId?: string | null;
  sessionRole: UserRole;
  organizationId: string;
}) {
  const organizations = await listHotelOperationsOrganizations({
    ...input,
    requestedOrganizationId: input.organizationId,
  });
  return organizations[0] ?? null;
}
