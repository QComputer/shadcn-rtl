import { NextRequest, NextResponse } from "next/server";
import { bookingSettingsService } from "@/lib/services/booking-settings.service";
import { updateBookingSettingsSchema } from "@/lib/validators";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { prisma } from "@/lib/db";

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
    const settings = await bookingSettingsService.getForOrganization(organizationSlug);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error getting booking settings:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationSlug = await resolveOrganizationSlug(session, id);
    const body = await request.json();
    const data = updateBookingSettingsSchema.parse(body);
    const settings = await bookingSettingsService.update(organizationSlug, data);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating booking settings:", error);
    return jsonError(error, "Internal server error");
  }
}
