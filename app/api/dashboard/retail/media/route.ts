import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api-guards";
import { createStoredImageFilename, validateImageBuffer, writeStoredImage } from "@/lib/media-storage";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { context } = await requireRetailMerchantContext();
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
    const cursor = request.nextUrl.searchParams.get("cursor");
    const paginated = request.nextUrl.searchParams.has("q") || request.nextUrl.searchParams.has("cursor");
    const limit = paginated ? 24 : 100;
    const images = await prisma.image.findMany({
      where: {
        organizationId: context.organizationId,
        access: "PUBLIC",
        ...(q ? { AND: [{ OR: [{ filename: { contains: q, mode: "insensitive" as const } }, { products: { some: { organizationId: context.organizationId, deletedAt: null, name: { contains: q, mode: "insensitive" as const } } } }] }] } : {}),
        OR: [
          { purpose: "retail-product" },
          { products: { some: { organizationId: context.organizationId, deletedAt: null } } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, access: true, products: { where: { organizationId: context.organizationId, deletedAt: null }, take: 3, select: { name: true } } },
    });
    return NextResponse.json({ images: images.slice(0, limit).map(({ products, ...image }) => ({ ...image, productNames: products.map(product => product.name) })), nextCursor: images.length > limit ? images[limit - 1]!.id : null });
  } catch (error) {
    return jsonError(error, "Could not load store images.");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose an image file to upload.");
    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageBuffer(buffer, file.type, file.size);
    const filename = createStoredImageFilename(file.type, "retail-product");
    const stored = await writeStoredImage(filename, buffer, "PUBLIC");
    const image = await prisma.image.create({ data: {
      url: stored.url,
      filename: stored.pathname,
      mimeType: file.type,
      sizeBytes: file.size,
      purpose: "retail-product",
      access: "PUBLIC",
      uploadedByUserId: session.user.id,
      organizationId: context.organizationId,
    }, select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, purpose: true, access: true, organizationId: true } });
    await prisma.auditLog.create({ data: {
      action: "CREATE",
      entityType: "Image",
      entityId: image.id,
      description: "Uploaded a retail product image.",
      userId: session.user.id,
      organizationId: context.organizationId,
      newValue: { mimeType: image.mimeType, sizeBytes: image.sizeBytes, purpose: image.purpose, access: image.access },
    } });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not upload this product image.");
  }
}
