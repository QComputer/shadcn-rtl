import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { createProductSchema, productFilterSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = productFilterSchema.parse(searchParams);

    // For customers, only show active products
    if (!session || session.user?.role === "CUSTOMER") {
      params.isActive = true;
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins, managers can create products
    if (!session?.user?.role || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createProductSchema.parse(body);

    // Get organization from user session or body
    const organizationId = body.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const product = await productService.create(organizationId, data, session.user!.role);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
