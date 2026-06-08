import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateOrganizationSettingsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";

async function getOrganizationSlug(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  if (!org?.slug) {
    throw new ApiError(404, "Organization not found");
  }

  return org.slug;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationSlug },
      include: {
        organization: {
          include: { businessHours: true, paymentSettings: true },
        },
      },
    });

    if (settings) {
      return NextResponse.json(settings);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessHours: true, paymentSettings: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return NextResponse.json({
      id: null,
      organizationSlug,
      currency: "IRR",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      minimumOrderAmount: null,
      maximumOrderAmount: null,
      deliveryRadius: null,
      deliveryFee: null,
      enablePickup: true,
      enableDelivery: true,
      emailNotifications: true,
      smsNotifications: false,
      settings: null,
      organization,
    });
  } catch (error) {
    console.error("Error getting settings:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const organizationSlug = await getOrganizationSlug(organizationId);

    const body = await request.json();
    const data = updateOrganizationSettingsSchema.parse(body) as any;

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: { organizationSlug, ...data },
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      description: "Updated organization settings",
      userId: session.user.id,
      organizationId,
      organizationSlug,
      newValue: data,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return jsonError(error, "Internal server error");
  }
}
