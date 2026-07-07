import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";

const REQUEST_DEMO_LEAD_STATUSES = [
  "NEW",
  "REVIEWED",
  "CONTACTED",
  "QUALIFIED",
  "REJECTED",
  "ARCHIVED",
] as const;

const updateLeadSchema = z.object({
  status: z.enum(REQUEST_DEMO_LEAD_STATUSES).optional(),
  adminNote: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const body = updateLeadSchema.parse(await request.json());

    const existing = await prisma.requestDemoLead.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true, businessName: true },
    });

    if (!existing) {
      throw new ApiError(404, "Lead not found");
    }

    const reviewedAt = body.status ? new Date() : undefined;

    const lead = await prisma.requestDemoLead.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.adminNote !== undefined && { adminNote: body.adminNote || null }),
        ...(reviewedAt && { reviewedAt, reviewedById: session.user.id }),
      },
      select: {
        id: true,
        status: true,
        source: true,
        locale: true,
        fullName: true,
        businessName: true,
        businessType: true,
        phone: true,
        city: true,
        preferredContactTime: true,
        needSummary: true,
        consentAccepted: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        adminNote: true,
        reviewedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "RequestDemoLead",
      entityId: lead.id,
      description: `Request demo lead status changed to ${lead.status}`,
      previousValue: { status: existing.status },
      newValue: { status: lead.status, adminNote: lead.adminNote },
      userId: session.user.id,
      organizationId: undefined,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "داده‌های ارسال شده نامعتبر است.", details: error.issues },
        { status: 400 },
      );
    }
    return jsonError(error, "Failed to update request demo lead");
  }
}
