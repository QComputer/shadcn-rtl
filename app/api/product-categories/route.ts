import { NextRequest, NextResponse } from "next/server";
import { productCategoryService } from "@/lib/services/category.service";
import { createProductCategorySchema } from "@/lib/validators";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
} from "@/lib/api-guards";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { requireTenantContext } from "@/lib/tenant-context";

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
      const categories = await productCategoryService.listAll(params);
      return NextResponse.json(categories);
    }

    if (session.user.role !== "SUPER_ADMIN") {
      if (!session.user.organizationId || (organizationId && organizationId !== session.user.organizationId)) {
        throw new ApiError(403, "Forbidden");
      }
      const context = await requireTenantContext(session, session.user.organizationId, ["ADMIN", "MANAGER", "STAFF"]);
      organizationId = context.organizationId;
    }

    if (!organizationId) throw new ApiError(400, "Organization ID is required");
    const categories = await productCategoryService.list(organizationId, params);
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error listing product categories:", error);
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
    await requireActiveOrganizationCapability({ organizationId, capability: "SHOP" });
    const categoryData = createProductCategorySchema.parse(body);
    const category = await productCategoryService.create(organizationId, categoryData);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating product category:", error);
    return jsonError(error, "Internal server error");
  }
}
