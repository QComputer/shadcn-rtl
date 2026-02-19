import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productCategoryService } from "@/lib/services/category.service";
import { createProductCategorySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const params: Record<string, string | boolean | undefined> = {};
    if (searchParams.get("page")) params.page = parseInt(searchParams.get("page")!);
    if (searchParams.get("pageSize")) params.pageSize = parseInt(searchParams.get("pageSize")!);
    if (searchParams.get("isActive")) params.isActive = searchParams.get("isActive") === "true";
    if (searchParams.get("search")) params.search = searchParams.get("search")!;

    const categories = await productCategoryService.list(organizationId, params);

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error listing product categories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "product:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createProductCategorySchema.parse(body);

    const { organizationId, ...categoryData } = body;
    
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const category = await productCategoryService.create(organizationId, categoryData);

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating product category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
