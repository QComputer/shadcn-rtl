import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { jsonError, requireAuthSession } from "@/lib/api-guards";

/**
 * GET /api/users/me/membership
 * Get the current user's active organization memberships.
 *
 * Backward compatibility:
 * - `membership` returns the first active membership for existing UI.
 * - `memberships` returns all active memberships for the Phase 3 multi-org path.
 */
export async function GET() {
  try {
    const session = await requireAuthSession();

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: { isActive: true, deletedAt: null },
      },
      orderBy: { joinedAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            capabilitiesInitializedAt: true,
            capabilities: {
              where: { status: "ACTIVE" },
              select: { key: true },
            },
            isOpen: true,
          },
        },
      },
    });

    const normalizedMemberships = memberships.map((membership) => ({
      id: membership.id,
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      organizationType: membership.organization.type,
      organizationCapabilities: membership.organization.capabilitiesInitializedAt
        ? membership.organization.capabilities.map((capability) => capability.key)
        : [membership.organization.type],
      organizationIsOpen: membership.organization.isOpen,
      role: membership.role,
      isActive: membership.isActive,
    }));

    return NextResponse.json({
      membership:
        normalizedMemberships.find((membership) => membership.organizationId === session.user.organizationId)
        ?? normalizedMemberships[0]
        ?? null,
      memberships: normalizedMemberships,
      message:
        normalizedMemberships.length === 0
          ? "No active organization membership found"
          : undefined,
    });
  } catch (error) {
    console.error("Error fetching organization membership:", error);
    return jsonError(error, "Internal server error");
  }
}
