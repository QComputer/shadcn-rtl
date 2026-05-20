import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateOrganizationSettingsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";

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

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationSlug },
      update: {},
      create: { organizationSlug },
      include: {
        organization: {
          include: { businessHours: true, paymentSettings: true },
        },
      },
    });

    return NextResponse.json(settings);
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

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return jsonError(error, "Internal server error");
  }
}
