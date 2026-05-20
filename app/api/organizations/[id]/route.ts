import { NextRequest, NextResponse } from "next/server";
import { updateOrganizationSchema } from "@/lib/validators";
import { organizationService } from "@/lib/services/organization.service";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);

    if (session.user.role !== "SUPER_ADMIN" && organizationId !== session.user.organizationId) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await request.json();
    const data = updateOrganizationSchema.parse(body);
    const organization = await organizationService.update(organizationId, data, session.user.role);

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);

    await organizationService.delete(organizationId, session.user.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return jsonError(error, "Internal server error");
  }
}
