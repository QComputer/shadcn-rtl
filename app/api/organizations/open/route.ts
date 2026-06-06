import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireCurrentOrgAdminOrManager } from "@/lib/api-guards";

async function resolveWritableOrganizationId() {
  const session = await requireAuthSession();
  const membership = await requireCurrentOrgAdminOrManager(session);
  const organizationId = session.user.role === "SUPER_ADMIN" ? session.user.organizationId : membership?.organizationId;

  if (!organizationId) {
    throw new ApiError(400, "Organization context is required");
  }

  return organizationId;
}

export async function GET(request: NextRequest) {
  try {
    const organizationId = await resolveWritableOrganizationId();
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, name: true, isOpen: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error reading organization open state:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const organizationId = await resolveWritableOrganizationId();
    const body = await request.json();

    if (typeof body.isOpen !== "boolean") {
      throw new ApiError(400, "isOpen boolean is required");
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: { isOpen: body.isOpen },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization open state:", error);
    return jsonError(error, "Internal server error");
  }
}
