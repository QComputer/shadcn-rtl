import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireSuperAdmin } from "@/lib/shop-domain-admin";

const updateDomainSchema = z.object({
  status: z.enum(["REQUESTED", "PROVIDER_PENDING", "DNS_REQUIRED", "VERIFYING", "ACTIVE", "ERROR", "DISABLED", "REMOVAL_PENDING", "REMOVED"]).optional(),
  isPrimary: z.boolean().optional(),
  failureReason: z.string().trim().max(1000).nullable().optional(),
  verificationToken: z.string().trim().max(500).nullable().optional(),
  vercelProjectDomainId: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domainId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);
    const { id: organizationId, domainId } = await params;
    const body = updateDomainSchema.parse(await request.json());

    const existing = await prisma.organizationDomain.findFirst({
      where: { id: domainId, organizationId },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "Domain not found");

    const domain = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.organizationDomain.updateMany({
          where: { organizationId, id: { not: domainId } },
          data: { isPrimary: false },
        });
      }

      return tx.organizationDomain.update({
        where: { id: domainId },
        data: {
          ...(body.status && { status: body.status }),
          ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
          ...(body.failureReason !== undefined && { failureReason: body.failureReason }),
          ...(body.verificationToken !== undefined && { verificationToken: body.verificationToken }),
          ...(body.vercelProjectDomainId !== undefined && { vercelProjectDomainId: body.vercelProjectDomainId }),
          ...(body.status === "ACTIVE" && { verifiedAt: new Date(), failureReason: null }),
          lastCheckedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ domain });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    return jsonError(error, "Failed to update organization domain");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; domainId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);
    const { id: organizationId, domainId } = await params;

    const existing = await prisma.organizationDomain.findFirst({
      where: { id: domainId, organizationId },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "Domain not found");

    await prisma.organizationDomain.delete({ where: { id: domainId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to delete organization domain");
  }
}
