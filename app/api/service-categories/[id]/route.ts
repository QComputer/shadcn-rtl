import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceCategoryService } from "@/lib/services/category.service";
import { updateServiceCategorySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const category = await serviceCategoryService.getById(id);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check access - user must be member of the organization
    if (session?.user?.id) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: category.organizationId,
        },
      });

      if (!membership && session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error getting service category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get existing category
    const existingCategory = await serviceCategoryService.getById(id);
    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check if user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingCategory.organizationId,
      },
    });

    if (!membership && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    
    // Convert null/undefined/empty string values to undefined for optional fields
    const sanitizedBody = { ...body };
    if (sanitizedBody.image === null || sanitizedBody.image === "") sanitizedBody.image = undefined;
    if (sanitizedBody.description === null || sanitizedBody.description === "") sanitizedBody.description = undefined;
    
    const data = updateServiceCategorySchema.parse(sanitizedBody);

    const category = await serviceCategoryService.update(id, data);

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating service category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get existing category
    const existingCategory = await serviceCategoryService.getById(id);
    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check if user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingCategory.organizationId,
      },
    });

    if (!membership && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if category has services
    const servicesCount = await prisma.service.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (servicesCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with existing services. Please move or delete services first." },
        { status: 400 }
      );
    }

    await serviceCategoryService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
