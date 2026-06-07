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
            basePrice: true,
            description: true,
            trackInventory: true,
            sortOrder: true,
            image: true,
            isActive: true,
            deletedAt: true,
            discountType: true,
            discountValue: true,
            variants: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                inventory: true,
                deletedAt: true,
              },
            },
          },
        },
        isActive: true,
        deletedAt: true,
      },
    });
    
    // Get product categories with products
    const activeCategories = organizationCategories
      .map((category) => ({
        ...category,
        products: category.products.filter((p) => p.isActive && !p.deletedAt),
      }))
      .filter(
        (category) =>
          category.isActive &&
          !category.deletedAt &&
          category.products.length > 0,
      );

    const categories = activeCategories
    // Get organization settings
    let settings = await prisma.organizationSettings.findUnique({
      where: {
         organizationSlug: slug,
      },
      select: {
        currency: true,
        enablePickup: true,
        enableDelivery: true,
        minimumOrderAmount: true,
        deliveryRadius: true,
        organization: {include: {paymentSettings: true}}
      },
    });
    if (!settings){
      settings = await prisma.organizationSettings.create({
        data: { organizationSlug: slug },
        select: {
          currency: true,
          enablePickup: true,
          enableDelivery: true,
          minimumOrderAmount: true,
          deliveryRadius: true,
          organization: { include: { paymentSettings: true } },
        },
      });
    } else if (!settings.organization.paymentSettings) {
      const paymentSettings = await prisma.paymentSettings.upsert({
        where: { organizationSlug: slug},
        update:{},
        create: { organizationSlug: slug },
      });
      settings = await prisma.organizationSettings.create({
        data: { organizationSlug: slug },
        select: {
          currency: true,
          enablePickup: true,
          enableDelivery: true,
          minimumOrderAmount: true,
          deliveryRadius: true,
          organization: { include: { paymentSettings: true } },
        },
      });
    }
      return NextResponse.json({
        organization: settings?.organization,
        categories: categories,
        settings,
        paymentSettings: settings?.organization?.paymentSettings,
      });
  } catch (error) {
    console.error("Error getting shop organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
