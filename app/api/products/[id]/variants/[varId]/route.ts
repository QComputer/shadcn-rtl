import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const { id, varId } = await params;
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get product variant by ID (internal use)
    const variant = await productService.getVariants(varId);

    if (!variant) {
      return NextResponse.json(
        { error: "Product variant not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(variant);
  } catch (error) {
    console.error("Error getting product variant:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

// update product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, varId } = await params;
    const body = await request.json();
    const data = updateProductSchema.parse(body);
    const variant = await productService.updateVariant({...data, id: varId}, session.user.role);

    return NextResponse.json(variant);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const session = await auth();
    const { id, varId } = await params;

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    session.user.role === "SUPER_ADMIN"
      ? await productService.hardDeleteVariant(varId, session.user.role)
      : await productService.deleteVariant(varId, session.user.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product variant:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
