import { NextRequest, NextResponse } from "next/server";
import { productCategoryService } from "@/lib/services/category.service";
import { updateProductCategorySchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireProductCategoryAccess,
} from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductCategoryAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const category = await productCategoryService.getById(id);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error getting product category:", error);
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
    await requireProductCategoryAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const sanitizedBody = { ...body };
    if (sanitizedBody.image === "") sanitizedBody.image = null;
    if (sanitizedBody.description === null || sanitizedBody.description === "") sanitizedBody.description = undefined;

    const data = updateProductCategorySchema.parse(sanitizedBody);
    const category = await productCategoryService.update(id, data);
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating product category:", error);
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
    await requireProductCategoryAccess(session, id, ["ADMIN", "MANAGER"]);

    const productsCount = await prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productsCount > 0) {
      throw new ApiError(400, "Cannot delete category with existing products. Please move or delete products first.");
    }

    await productCategoryService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product category:", error);
    return jsonError(error, "Internal server error");
  }
}
