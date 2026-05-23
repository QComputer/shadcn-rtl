import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { createProductVariantSchema, updateProductVariantSchema } from "@/lib/validators";
import {
  jsonError,
  requireAuthSession,
  requireProductAccess,
} from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const variants = await productService.getVariants(id);
    return NextResponse.json(variants);
  } catch (error) {
    console.error("Error getting variants:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const data = createProductVariantSchema.parse(body);
    const variant = await productService.createVariant(id, data, session.user.role, session.user.id);

    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    console.error("Error creating variant:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const data = updateProductVariantSchema.parse(body);

    const variant = await productService.getVariant(data.id);
    if (!variant) throw new Error("Product variant not found");
    await requireProductAccess(session, variant.productId, ["ADMIN", "MANAGER"]);

    const product = await productService.updateVariant(data, session.user.role, session.user.id);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Error updating product variant:", error);
    return jsonError(error, "Internal server error");
  }
}
