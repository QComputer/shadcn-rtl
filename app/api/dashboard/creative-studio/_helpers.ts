import {
  ApiError,
  requireAuthSession,
  requireOrgAccess,
  type SessionWithUser,
} from "@/lib/api-guards";

export async function requireCreativeStudioOrganization(
  requestedOrganizationId?: string | null,
) {
  const session = await requireAuthSession();
  const organizationId = session.user.role === "SUPER_ADMIN"
    ? requestedOrganizationId || session.user.organizationId
    : session.user.organizationId;

  if (!organizationId) {
    throw new ApiError(400, "Organization is required");
  }

  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
  return { session, organizationId };
}

export async function requireCreativeStudioJobOrganization(
  session: SessionWithUser,
  organizationId: string,
) {
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"]);
}
