import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ApiError,
  getMembershipRole,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards";
import { businessHoursSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

function normalizeOrganizationId(request: NextRequest, fallback?: string | null) {
  return request.nextUrl.searchParams.get("organizationId") || fallback || null;
}

function assertUniqueDays(hours: z.infer<typeof businessHoursSchema>) {
  const seen = new Set<string>();
  for (const item of hours) {
    if (seen.has(item.day)) {
      throw new ApiError(400, `Duplicate business hour day: ${item.day}`);
    }
    seen.add(item.day);
  }
}

async function resolveBusinessHoursOrganization(request: NextRequest, userId: string) {
  const requestedOrganizationId = normalizeOrganizationId(request);
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      isActive: true,
      ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {}),
    },
    orderBy: { joinedAt: "desc" },
    include: { organization: { select: { id: true, isActive: true, name: true } } },
  });

  if (!membership || !membership.organization?.isActive) {
    throw new ApiError(403, "No active organization membership found");
  }

  return membership;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const membership = await resolveBusinessHoursOrganization(request, session.user.id);

    const hours = await prisma.businessHour.findMany({
      where: {
        userId: session.user.id,
        organizationId: membership.organizationId,
      },
      orderBy: { day: "asc" },
    });

    return NextResponse.json({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      hours,
    });
  } catch (error) {
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const membership = await resolveBusinessHoursOrganization(request, session.user.id);
    const membershipRole = getMembershipRole(membership);
    if (!membershipRole) throw new ApiError(403, "Forbidden");

    await requireOrgAccess(session, membership.organizationId, ["ADMIN", "MANAGER", "STAFF"]);

    const body = await request.json();
    const data = businessHoursSchema.parse(body);
    assertUniqueDays(data);

    await prisma.$transaction(async (tx) => {
      await tx.businessHour.deleteMany({
        where: { userId: session.user.id, organizationId: membership.organizationId },
      });

      if (data.length > 0) {
        await tx.businessHour.createMany({
          data: data.map((h) => ({
            day: h.day,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isOpen: h.isOpen,
            organizationId: membership.organizationId,
            userId: session.user.id,
          })),
        });
      }
    });

    const hours = await prisma.businessHour.findMany({
      where: { userId: session.user.id, organizationId: membership.organizationId },
      orderBy: { day: "asc" },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "BusinessHour",
      entityId: `${membership.organizationId}:${session.user.id}`,
      description: "User updated their own organization business hours",
      newValue: hours,
      userId: session.user.id,
      organizationId: membership.organizationId,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      hours,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    return jsonError(error, "Internal server error");
  }
}
