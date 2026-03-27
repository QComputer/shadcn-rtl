import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { organizationService } from "@/lib/services/organization.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get organization by slug
        const organization = await organizationService.getBySlugPublic(slug);
      console.log("---------------organization/slug/shop Layout");


    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Only allow SHOP type for public shop pages
    if (organization.type !== "SHOP") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
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
        organizationId: organization.id, userId: null
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
