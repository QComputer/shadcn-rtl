import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { revalidatePath } from "next/cache";

type GalleryTarget = { productId: string; variantId?: string | null; organizationId: string; organizationSlug: string };

function revalidateGallery(slug: string, productId: string) {
  revalidatePath(`/fa/${slug}/shop`);
  revalidatePath(`/en/${slug}/shop`);
  revalidatePath(`/fa/${slug}/shop/product/${productId}`);
  revalidatePath(`/en/${slug}/shop/product/${productId}`);
}

async function resolveTarget(productId: string, variantId?: string | null): Promise<GalleryTarget> {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, organizationId: true, organizationSlug: true, variants: { where: { id: variantId || undefined, deletedAt: null }, select: { id: true } } },
  });
  if (!product || (variantId && product.variants.length !== 1)) throw new ApiError(404, "Product gallery target not found");
  return { productId: product.id, organizationId: product.organizationId, organizationSlug: product.organizationSlug, variantId: variantId || null };
}

export async function listProductGallery(productId: string, variantId?: string | null) {
  const target = await resolveTarget(productId, variantId);
  return prisma.productGalleryImage.findMany({
    where: { productId: target.productId, variantId: target.variantId },
    include: { image: { select: { id: true, url: true, thumbnailUrl: true, filename: true, mimeType: true, sizeBytes: true } } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function addProductGalleryImage(input: { productId: string; variantId?: string | null; imageId: string; actorOrganizationId: string; sortOrder?: number; isPrimary?: boolean }) {
  const target = await resolveTarget(input.productId, input.variantId);
  if (target.organizationId !== input.actorOrganizationId) throw new ApiError(403, "Organization boundary violation");
  const image = await prisma.image.findFirst({ where: { id: input.imageId, organizationId: target.organizationId }, select: { id: true, url: true, thumbnailUrl: true } });
  if (!image) throw new ApiError(404, "Image not found for organization");
  const result = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) await tx.productGalleryImage.updateMany({ where: { productId: target.productId, variantId: target.variantId }, data: { isPrimary: false } });
    const count = await tx.productGalleryImage.count({ where: { productId: target.productId, variantId: target.variantId } });
    return tx.productGalleryImage.create({ data: { productId: target.productId, variantId: target.variantId, imageId: image.id, organizationId: target.organizationId, sortOrder: input.sortOrder ?? count, isPrimary: input.isPrimary ?? count === 0, thumbnailUrl: image.thumbnailUrl || image.url }, include: { image: true } });
  });
  revalidateGallery(target.organizationSlug, target.productId);
  return result;
}

export async function updateProductGalleryImage(input: { id: string; actorOrganizationId: string; sortOrder?: number; isPrimary?: boolean }) {
  const current = await prisma.productGalleryImage.findFirst({ where: { id: input.id, organizationId: input.actorOrganizationId }, include: { product: { select: { organizationSlug: true, id: true } } } });
  if (!current) throw new ApiError(404, "Gallery image not found");
  const result = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) await tx.productGalleryImage.updateMany({ where: { productId: current.productId, variantId: current.variantId }, data: { isPrimary: false } });
    return tx.productGalleryImage.update({ where: { id: current.id }, data: { sortOrder: input.sortOrder, isPrimary: input.isPrimary }, include: { image: true } });
  });
  revalidateGallery(current.product.organizationSlug, current.product.id);
  return result;
}

export async function removeProductGalleryImage(id: string, actorOrganizationId: string) {
  const current = await prisma.productGalleryImage.findFirst({ where: { id, organizationId: actorOrganizationId }, include: { product: { select: { organizationSlug: true, id: true } } } });
  if (!current) throw new ApiError(404, "Gallery image not found");
  await prisma.productGalleryImage.delete({ where: { id } });
  revalidateGallery(current.product.organizationSlug, current.product.id);
}
