import { NextRequest, NextResponse } from "next/server";
import { serviceCategoryService } from "@/lib/services/category.service";
import { createServiceCategorySchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
} from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = request.nextUrl;
    let organizationId = searchParams.get("organizationId");

    const params: Record<string, string | boolean | number | undefined> = {};
    params.page = parseInt(searchParams.get("page") || "1", 10);
    params.pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
    params.search = searchParams.get("search") || undefined;

    if (session.user.role === "SUPER_ADMIN" && !organizationId) {
      const categories = await serviceCategoryService.listAll(params);
      return NextResponse.json(categories);
    }

    if (session.user.role !== "SUPER_ADMIN") {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      });
      if (!membership) throw new ApiError(403, "Forbidden");
      if (organizationId && organizationId !== membership.organizationId) {
        throw new ApiError(403, "Forbidden");
      }
      organizationId = membership.organizationId;
    }

    if (!organizationId) throw new ApiError(400, "Organization ID is required");
    const categories = await serviceCategoryService.list(organizationId, params);
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error listing service categories:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const organizationId = await requireCurrentOrganizationId(
      session,
      body.organizationId ?? session.user.organizationId,
    );
    const data = createServiceCategorySchema.parse(body);
    const category = await serviceCategoryService.create(organizationId, data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating service category:", error);
    return jsonError(error, "Internal server error");
  }
}
