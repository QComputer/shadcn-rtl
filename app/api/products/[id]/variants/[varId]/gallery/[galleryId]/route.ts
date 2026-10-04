import { NextRequest, NextResponse } from "next/server"
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards"
import { listProductGallery, removeProductGalleryImage, updateProductGalleryImage } from "@/lib/services/product-gallery.service"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; varId: string; galleryId: string }> }) {
  try {
    const session = await requireAuthSession()
    const { id, varId, galleryId } = await params
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"])
    const body = await request.json()
    const belongs = (await listProductGallery(id, varId)).some((item) => item.id === galleryId)
    if (!belongs) return NextResponse.json({ error: "Gallery image does not belong to variant" }, { status: 404 })
    const current = await updateProductGalleryImage({ id: galleryId, actorOrganizationId: product.organizationId, sortOrder: body.sortOrder, isPrimary: body.isPrimary })
    return NextResponse.json(current)
  } catch (error) { return jsonError(error, "Failed to update variant gallery image") }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; varId: string; galleryId: string }> }) {
  try {
    const session = await requireAuthSession()
    const { id, varId, galleryId } = await params
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"])
    const belongs = (await listProductGallery(id, varId)).some((item) => item.id === galleryId)
    if (!belongs) return NextResponse.json({ error: "Gallery image does not belong to variant" }, { status: 404 })
    await removeProductGalleryImage(galleryId, product.organizationId)
    return NextResponse.json({ success: true })
  } catch (error) { return jsonError(error, "Failed to remove variant gallery image") }
}
