import "server-only";

import type { UserRole } from "@prisma/client";
import { ApiError, requireOrgAccess, type SessionWithUser } from "@/lib/api-guards";
import prisma from "@/lib/db";

export type TenantContext = {
  organizationId: string;
  organizationSlug: string;
  actorUserId: string;
  role: UserRole;
};

/**
 * Resolves an explicit tenant and authorizes against that tenant's membership.
 * New tenant-scoped endpoints should not infer a tenant from the first membership.
 */
export async function requireTenantContext(
  session: SessionWithUser,
  organizationId: string | null | undefined,
  allowedRoles: UserRole[],
): Promise<TenantContext> {
  if (!organizationId) throw new ApiError(400, "Organization ID is required");
  if (
    session.user.role !== "SUPER_ADMIN" &&
    session.user.organizationId &&
    session.user.organizationId !== organizationId
  ) {
    throw new ApiError(403, "Tenant context mismatch");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");

  const membership = await requireOrgAccess(session, organization.id, allowedRoles);
  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    actorUserId: session.user.id,
    role: (membership?.role ?? session.user.role) as UserRole,
  };
}
