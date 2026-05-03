import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/users/me/membership
 * Get the current user's organization membership
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization membership with organization details
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isOpen: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { membership: null, message: "No active organization membership found" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      membership: {
        id: membership.id,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        organizationType: membership.organization.type,
        organizationIsOpen: membership.organization.isOpen,
        role: session.role,
        isActive: membership.isActive,
      },
    });
  } catch (error) {
    console.error("Error fetching organization membership:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
