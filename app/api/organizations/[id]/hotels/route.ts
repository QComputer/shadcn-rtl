import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { createPropertySchema } from "@/lib/hotel/validation/management-contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { id: organizationId } = await params;
    if (session.user.role !== "SUPER_ADMIN" && session.user.organizationId !== organizationId) throw new ApiError(403, "Forbidden");
    const organization = await prisma.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { slug: true } });
    if (!organization) throw new ApiError(404, "Organization not found");
    const body = createPropertySchema.parse(parseJsonObject(await request.json()));
    const property = await new HotelManagementService().createProperty(managementPrincipal(session), { ...body, organizationId, organizationSlug: organization.slug });
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    return managementError(error);
  }
}
