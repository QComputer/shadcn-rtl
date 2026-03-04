import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
console.log("==================== Shop ++++++++++++++++++++++");

    const { slug } = await params;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { 
        slug,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        coverImage: true,
        type: true,
        locale: true,
        timezone: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Only allow SHOP type for public shop pages
    if (organization.type !== "SHOP") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
console.log('==================== Shop ++++++++++++++++++++++')
    // Get product categories with products
    const categories = await prisma.productCategory.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        products: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
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
            },
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    // Get business hours
    const businessHours = await prisma.businessHour.findMany({
      where: {
        organizationId: organization.id,
      },
      orderBy: {
        day: "asc",
      },
    });

    // Get organization settings
    const settings = await prisma.organizationSettings.findUnique({
      where: {
        organizationId: organization.id,
      },
      select: {
        currency: true,
        enablePickup: true,
        enableDelivery: true,
        minimumOrderAmount: true,
        deliveryRadius: true,
      },
    });

    return NextResponse.json({
      organization,
      categories,
      businessHours,
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
