import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validators";
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

    const product = await productService.getById(id);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Error getting product:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const data = updateProductSchema.parse(body);
    const product = await productService.update(id, data, session.user.role);

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);

    session.user.role === "SUPER_ADMIN"
      ? await productService.hardDelete(id, session.user.role)
      : await productService.delete(id, session.user.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return jsonError(error, "Internal server error");
  }
}
