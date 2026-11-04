import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { ensureImageDerivatives } from "@/lib/retail/image-derivatives.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  try {
    assertRetailMutationOrigin(request);
    const { context } = await requireRetailMerchantContext();
    const { imageId } = await params;
    const image = await prisma.image.findFirst({
      where: {
        id: imageId,
        organizationId: context.organizationId,
        access: "PUBLIC",
        OR: [
          { purpose: { in: ["retail-product", "retail-category"] } },
          { products: { some: { organizationId: context.organizationId, deletedAt: null } } },
        ],
      },
      select: { id: true, url: true, filename: true, organizationId: true, access: true, derivatives: true },
    });
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    const derivatives = await ensureImageDerivatives(image, context.organizationId);
    return NextResponse.json({
      image: { id: image.id, url: image.url, derivatives },
      optimized: derivatives !== null,
    });
  } catch (error) {
    return jsonError(error, "Could not prepare this image for the store catalog.");
  }
}
