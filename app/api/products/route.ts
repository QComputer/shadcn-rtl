import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { createProductSchema, productFilterSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    
    // Convert string booleans to actual booleans
    const sanitizedParams: Record<string, unknown> = { ...searchParams };
    if (sanitizedParams.isActive === "true") sanitizedParams.isActive = true;
    if (sanitizedParams.isActive === "false") sanitizedParams.isActive = false;
    if (sanitizedParams.isActive === "") sanitizedParams.isActive = undefined;
    
    const params = productFilterSchema.parse(sanitizedParams);

    // For customers, only show active products
    if (!session || session.user?.role === "CUSTOMER") {
      params.isActive = true;
    }

    // Auto-filter by organization for staff users (not SUPER_ADMIN)
    if (session?.user?.role && 
        !["SUPER_ADMIN"].includes(session.user.role) && 
        !params.organizationId) {
      // Get user's organization membership
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      
      if (membership) {
        params.organizationId = membership.organizationId;
      }
    }

    const products = await productService.list(params);

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error listing products:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// creating product
export async function POST(request: NextRequest) {
  try {

    const session = await auth();

    // Only admins, managers can create products
    if (!session?.user?.role || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();

    // Get organization from user session or body
    const organizationId = session.user.role === "SUPER_ADMIN" ? body.organizationId : session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 },
      );
    } 

    const data = createProductSchema.parse({ ...body, organizationId });

    const product = await productService.create(
      data,
      session.user!.role,
    );

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
