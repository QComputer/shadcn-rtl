import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updatePaymentSettingsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { hasPermission } from "@/lib/types";

async function resolveOrganizationSlug(session: Awaited<ReturnType<typeof requireAuthSession>>, requestedId: string) {
  const organizationId = await resolveManageableOrganizationId(session, requestedId);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  if (!organization?.slug) {
    throw new ApiError(404, "Organization not found");
  }

  return organization.slug;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationSlug = await resolveOrganizationSlug(session, id);

    const paymentSettings = await prisma.paymentSettings.findUnique({
      where: { organizationSlug },
    });

    return NextResponse.json(paymentSettings || {});
  } catch (error) {
    console.error("Error getting settings:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationSlug = await resolveOrganizationSlug(session, id);
    if (!hasPermission(session.user.role, "payment:manage")) {
      throw new ApiError(403, "Forbidden");
    }
    const data = updatePaymentSettingsSchema.parse(await request.json());

    const paymentSettings = await prisma.paymentSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: {
        organizationSlug,
        ...data,
      },
    });

    return NextResponse.json(paymentSettings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return jsonError(error, "Internal server error");
  }
}
