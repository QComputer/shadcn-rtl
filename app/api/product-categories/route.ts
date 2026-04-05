import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productCategoryService } from "@/lib/services/category.service";
import { createProductCategorySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const session = await auth();
    
    // Get organizationId from query or from user's membership
    let organizationId = searchParams.get("organizationId");

    if (!organizationId && session?.user?.id) {
          // Check if user is SUPER_ADMIN - they can access any organization
          if (session.user.role === "SUPER_ADMIN") {
            // For SUPER_ADMIN, if no org specified, return all categories across all organizations
            if (!organizationId) {
              const params: Record<string, string | boolean | number | undefined> = {};
              params.page = parseInt(searchParams.get("page") || "1");
              params.pageSize = parseInt(searchParams.get("pageSize") || "20");
              params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
              params.search = searchParams.get("search") || undefined;
    
              // Get all categories without organization filter for SUPER_ADMIN
              const categories = await productCategoryService.listAll(params);
    
              return NextResponse.json(categories);
            }
          } else {
            // Regular user - get from membership
            const membership = await prisma.organizationMember.findFirst({
              where: { userId: session.user.id },
              select: { organizationId: true },
            });
            if (membership) {
              organizationId = membership.organizationId;
            }
          }
        }
    
        if (!organizationId) {
          return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
        }
    
        const params: Record<string, string | boolean | number | undefined> = {};
        params.page = parseInt(searchParams.get("page") || "1");
        params.pageSize = parseInt(searchParams.get("pageSize") || "20");
        params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
        params.search = searchParams.get("search") || undefined;
    
        const categories = await productCategoryService.list(organizationId, params);
    
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
