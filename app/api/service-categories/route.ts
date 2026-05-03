import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceCategoryService } from "@/lib/services/category.service";
import { createServiceCategorySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = request.nextUrl;
    
    // Get organizationId from query or from user's membership
    let organizationId = searchParams.get("organizationId");
    
    // If not provided, try to get from user's membership
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
          const categories = await serviceCategoryService.listAll(params);

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

    let { organizationId, ...categoryData } = body;
    
    // If organizationId not provided, get from user's membership
    if (!organizationId) {
      // For SUPER_ADMIN, organizationId is required
      if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json({ error: "Organization ID is required for SUPER_ADMIN" }, { status: 400 });
      }
      
      // For regular users, get from membership
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      
      if (!membership) {
        return NextResponse.json({ error: "You must be a member of an organization" }, { status: 400 });
      }
      
      organizationId = membership.organizationId;
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
