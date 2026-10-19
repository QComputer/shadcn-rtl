import "server-only";

import type { UserRole } from "@prisma/client";
import prisma from "@/lib/db";

export type HotelCmsDashboardProperty = { id: string; name: string; slug: string };
export type HotelCmsDashboardOrganization = {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MANAGER" | "SUPER_ADMIN";
  properties: HotelCmsDashboardProperty[];
};

/**
 * Resolve dashboard scope from the signed-in server session plus current DB
 * membership/capability state. Requested IDs only select within this verified
 * result; they never establish tenant authority.
 */
export async function listHotelCmsDashboardOrganizations(input: {
  userId: string;
  sessionOrganizationId?: string | null;
  sessionRole: UserRole;
  requestedOrganizationId?: string | null;
}): Promise<HotelCmsDashboardOrganization[]> {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) return [];

  const isPlatformAdmin = user.role === "SUPER_ADMIN" && input.sessionRole === "SUPER_ADMIN";
  if (input.sessionRole === "SUPER_ADMIN" && !isPlatformAdmin) return [];

  let organizationIds: string[];
  const tenantRoles = new Map<string, "ADMIN" | "MANAGER">();
  if (isPlatformAdmin) {
    organizationIds = input.requestedOrganizationId
      ? [input.requestedOrganizationId]
      : (await prisma.organization.findMany({
          where: {
            vertical: "HOTEL",
            isActive: true,
            deletedAt: null,
            capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null } } },
          },
          select: { id: true },
        })).map((organization) => organization.id);
  } else {
    const currentOrganizationId = input.sessionOrganizationId;
    if (!currentOrganizationId || (input.requestedOrganizationId && input.requestedOrganizationId !== currentOrganizationId)) return [];
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: input.userId,
        organizationId: currentOrganizationId,
        isActive: true,
        role: { in: ["ADMIN", "MANAGER"] },
        organization: {
          vertical: "HOTEL",
          isActive: true,
          deletedAt: null,
          capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null } } },
        },
      },
      select: { organizationId: true, role: true },
    });
    if (!membership) return [];
    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") return [];
    organizationIds = [membership.organizationId];
    tenantRoles.set(membership.organizationId, membership.role);
  }

  if (organizationIds.length === 0) return [];
  const organizations = await prisma.organization.findMany({
    where: {
      id: { in: organizationIds },
      vertical: "HOTEL",
      isActive: true,
      deletedAt: null,
      capabilities: { some: { key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: { not: null } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      hotelProperties: {
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: isPlatformAdmin ? "SUPER_ADMIN" : tenantRoles.get(organization.id) ?? "MANAGER",
    properties: organization.hotelProperties,
  }));
}

export async function getHotelCmsDashboardOrganization(input: {
  userId: string;
  sessionOrganizationId?: string | null;
  sessionRole: UserRole;
  organizationId: string;
}): Promise<HotelCmsDashboardOrganization | null> {
  const organizations = await listHotelCmsDashboardOrganizations({ ...input, requestedOrganizationId: input.organizationId });
  if (input.sessionRole === "SUPER_ADMIN") return organizations[0] ?? null;
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: input.userId, organizationId: input.organizationId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } },
    select: { role: true },
  });
  const organization = organizations[0];
  if (!organization || !membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) return null;
  return { ...organization, role: membership.role };
}
