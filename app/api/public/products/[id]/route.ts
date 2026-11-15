import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canReadAiMediaEntityAttachmentColumns } from "@/lib/services/ai-media-entity-attachment-service";

function isSafePublicMediaUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const organizationSlug = searchParams.get("organizationSlug");
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();

    // Build the where clause
    const where: Record<string, unknown> = {
      OR: [{ id }, { slug: id }],
      isActive: true,
      deletedAt: null,
    };

    // If organization slug is provided, filter by it
    if (organizationSlug) {
      const organization = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true },
      });

      if (!organization) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }

      where.organizationId = organization.id;
    }

    // Get product with details
    const product = await prisma.product.findFirst({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        basePrice: true,
        image: true,
        organizationId: true,
        images: { select: { url: true, organizationId: true, access: true } },
        ...(includeAiMediaAttachment ? { aiPrimaryMediaAssetId: true } : {}),
        sku: true,
        trackInventory: true,
        lowStockThreshold: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        variants: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            inventory: true,
          },
          orderBy: {
            name: "asc",
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const publicImages = product.images.filter((image) => image.access === "PUBLIC"
      && (!image.organizationId || image.organizationId === product.organizationId)
      && isSafePublicMediaUrl(image.url));
    const image = product.image && isSafePublicMediaUrl(product.image)
      && (product.images.length === 0 || publicImages.some((candidate) => candidate.url === product.image))
      ? product.image
      : publicImages[0]?.url ?? null;
    const images = [...new Set(publicImages.map((candidate) => candidate.url))];

    return NextResponse.json({
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        image,
        images: images.filter((url) => url !== image),
        aiPrimaryMediaAssetId: includeAiMediaAttachment ? product.aiPrimaryMediaAssetId ?? null : null,
        sku: product.sku,
        trackInventory: product.trackInventory,
        lowStockThreshold: product.lowStockThreshold,
        category: product.category,
        variants: product.variants,
      },
      organization: product.organization,
    });
  } catch (error) {
    console.error("Error getting product:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
