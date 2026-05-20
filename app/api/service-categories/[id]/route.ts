import { NextRequest, NextResponse } from "next/server";
import { serviceCategoryService } from "@/lib/services/category.service";
import { updateServiceCategorySchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireServiceCategoryAccess,
} from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireServiceCategoryAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const category = await serviceCategoryService.getById(id);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error getting service category:", error);
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
    await requireServiceCategoryAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const sanitizedBody = { ...body };
    if (sanitizedBody.image === null || sanitizedBody.image === "") sanitizedBody.image = undefined;
    if (sanitizedBody.description === null || sanitizedBody.description === "") sanitizedBody.description = undefined;

    const data = updateServiceCategorySchema.parse(sanitizedBody);
    const category = await serviceCategoryService.update(id, data);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating service category:", error);
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
    await requireServiceCategoryAccess(session, id, ["ADMIN", "MANAGER"]);

    const servicesCount = await prisma.service.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (servicesCount > 0) {
      throw new ApiError(400, "Cannot delete category with existing services. Please move or delete services first.");
    }

    await serviceCategoryService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service category:", error);
    return jsonError(error, "Internal server error");
  }
}
