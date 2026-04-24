import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const organizationCategories = await prisma.productCategory.findMany({
      where: {
        organizationSlug: slug,
      },
      select: {
        id: true,
        name: true,
        products: {
          select: {
            id: true,
            name: true,
            variants: true,
            image: true,
            isActive: true,
            deletedAt: true,
          },
        },
        isActive: true,
        deletedAt: true,
      },
    });
    
    // Get product categories with products
    const categories = organizationCategories.filter(
      (cat) => cat.isActive && !cat.deletedAt && cat.products.length > 0
    );

    const activeCategories = categories
      .map((category) => ({
        ...category,
        products: category.products.filter((p) => !p.deletedAt),
      }))
      .filter((category) => category.products.length > 0);

    // Get organization settings
    const settings = await prisma.organizationSettings.findUnique({
      where: {
         organizationSlug: slug,
      },
      select: {
        currency: true,
        enablePickup: true,
        enableDelivery: true,
        minimumOrderAmount: true,
        deliveryRadius: true,
        organization: true
      },
    });
    
    return NextResponse.json({
      organization: settings?.organization,
      categories: activeCategories,
      settings,
    });
  } catch (error) {
    console.error("Error getting shop organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
