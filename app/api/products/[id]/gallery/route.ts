import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards";
import { addProductGalleryImage, listProductGallery } from "@/lib/services/product-gallery.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireProductAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    return NextResponse.json(await listProductGallery(id));
  } catch (error) { return jsonError(error, "Failed to load product gallery"); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);
    const body = await request.json();
    const result = await addProductGalleryImage({ productId: id, imageId: String(body.imageId), actorOrganizationId: product.organizationId, sortOrder: body.sortOrder, isPrimary: body.isPrimary });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return jsonError(error, "Failed to add product gallery image"); }
}
