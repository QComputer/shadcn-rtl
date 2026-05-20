import { NextRequest, NextResponse } from "next/server";
import { serviceService } from "@/lib/services/service.service";
import { updateServiceSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireServiceAccess,
} from "@/lib/api-guards";

async function assertProviderBelongsToOrganization(providerId: string | null | undefined, organizationId: string) {
  if (!providerId) return;
  const providerMembership = await prisma.organizationMember.findFirst({
    where: { userId: providerId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!providerMembership) throw new ApiError(400, "Service provider must belong to the service organization");
}

async function assertCategoryBelongsToOrganization(categoryId: string | null | undefined, organizationId: string) {
  if (!categoryId) return;
  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new ApiError(400, "Service category must belong to the service organization");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireServiceAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const service = await serviceService.getById(id);
    return NextResponse.json({ service: { ...service, price: Number(service?.price ?? 0) } });
  } catch (error) {
    console.error("Error getting service:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const existingService = await requireServiceAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const sanitizedBody = { ...body };
    if (sanitizedBody.image === null || sanitizedBody.image === "") sanitizedBody.image = undefined;
    if (sanitizedBody.description === null || sanitizedBody.description === "") sanitizedBody.description = undefined;
    if (sanitizedBody.categoryId === null || sanitizedBody.categoryId === "") sanitizedBody.categoryId = undefined;
    if (sanitizedBody.serviceProviderId === null || sanitizedBody.serviceProviderId === "") sanitizedBody.serviceProviderId = undefined;

    const data = updateServiceSchema.partial().parse(sanitizedBody);
    await assertCategoryBelongsToOrganization(data.categoryId, existingService.organizationId);
    await assertProviderBelongsToOrganization(data.serviceProviderId, existingService.organizationId);

    const service = await serviceService.update(id, data);
    return NextResponse.json({ service: { ...service, price: Number(service.price) } });
  } catch (error) {
    console.error("Error updating service:", error);
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
    await requireServiceAccess(session, id, ["ADMIN", "MANAGER"]);
    await serviceService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return jsonError(error, "Internal server error");
  }
}
