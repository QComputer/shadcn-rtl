import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { updateProductVariantSchema } from "@/lib/validators";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireProductAccess,
} from "@/lib/api-guards";

async function requireVariantProductAccess(
  session: Awaited<ReturnType<typeof requireAuthSession>>,
  productId: string,
  variantId: string,
  write = false,
) {
  const variant = await productService.getVariant(variantId);
  if (!variant || variant.productId !== productId) {
    throw new ApiError(404, "Product variant not found");
  }
  await requireProductAccess(session, productId, write ? ["ADMIN", "MANAGER"] : ["ADMIN", "MANAGER", "STAFF"]);
  return variant;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, varId } = await params;
    const variant = await requireVariantProductAccess(session, id, varId);
    return NextResponse.json(variant);
  } catch (error) {
    console.error("Error getting product variant:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, varId } = await params;
    await requireVariantProductAccess(session, id, varId, true);

    const body = await request.json();
    const data = updateProductVariantSchema.parse({ ...body, id: varId });
    const variant = await productService.updateVariant(data, session.user.role);

    return NextResponse.json(variant);
  } catch (error) {
    console.error("Error updating product variant:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, varId } = await params;
    await requireVariantProductAccess(session, id, varId, true);

    session.user.role === "SUPER_ADMIN"
      ? await productService.hardDeleteVariant(varId, session.user.role)
      : await productService.deleteVariant(varId, session.user.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product variant:", error);
    return jsonError(error, "Internal server error");
  }
}
