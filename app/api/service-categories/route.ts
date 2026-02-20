import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceCategoryService } from "@/lib/services/category.service";
import { createServiceCategorySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const params: Record<string, string | boolean | number | undefined> = {};
    params.page = parseInt(searchParams.get("page") || "1");
    params.pageSize = parseInt(searchParams.get("pageSize") || "20");
    params.isActive = searchParams.get("isActive") === "true";
    params.search = searchParams.get("search")!;

    const categories = await serviceCategoryService.list(organizationId, params);

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error listing service categories:", error);
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

    if (!hasPermission(session.user.role, "service:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createServiceCategorySchema.parse(body);

    const { organizationId, ...categoryData } = body;
    
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const category = await serviceCategoryService.create(organizationId, categoryData);

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating service category:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
