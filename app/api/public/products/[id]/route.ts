import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const organizationSlug = searchParams.get("organizationSlug");

    // Build the where clause
    const where: Record<string, unknown> = {
      id,
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
      include: {
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

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        images: product.images,
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
