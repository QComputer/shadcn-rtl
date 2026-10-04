import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards";
import { removeProductGalleryImage, updateProductGalleryImage } from "@/lib/services/product-gallery.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; galleryId: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id, galleryId } = await params;
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);
    const body = await request.json();
    return NextResponse.json(await updateProductGalleryImage({ id: galleryId, actorOrganizationId: product.organizationId, sortOrder: body.sortOrder, isPrimary: body.isPrimary }));
  } catch (error) { return jsonError(error, "Failed to update product gallery image"); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; galleryId: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id, galleryId } = await params;
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);
    await removeProductGalleryImage(galleryId, product.organizationId);
    return NextResponse.json({ success: true });
  } catch (error) { return jsonError(error, "Failed to remove product gallery image"); }
}
