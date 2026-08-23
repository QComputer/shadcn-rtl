import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canReadAiMediaEntityAttachmentColumns } from "@/lib/services/ai-media-entity-attachment-service";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const includeAiMediaAttachment = canReadAiMediaEntityAttachmentColumns();
    const organization = await prisma.organization.findFirst({
      where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
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
        isOpen: true,
        isActive: true,
        capabilitiesInitializedAt: true,
        capabilities: { select: { key: true, status: true } },
      },
    });

    if (!organization || !hasOrganizationCapability({
      legacyType: organization.type,
      capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
      capabilities: organization.capabilities,
    }, "SHOP")) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organizationCategories = await prisma.productCategory.findMany({
      where: {
        organizationSlug: slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        products: {
          select: {
            id: true,
            slug: true,
            name: true,
            basePrice: true,
            description: true,
            trackInventory: true,
            sortOrder: true,
            image: true,
            ...(includeAiMediaAttachment ? { aiPrimaryMediaAssetId: true } : {}),
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
    // Get organization settings without mutating public GET state and without loading
    // the Organization relation. Some deployed databases do not yet have newer
    // Organization columns such as lat/lng, so this route must select only the
    // public shop fields it needs.
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
        deliveryFee: true,
      },
    });

    const paymentSettings = await prisma.paymentSettings.findUnique({
      where: {
        organizationSlug: slug,
      },
      select: {
        id: true,
        organizationSlug: true,
        cardOwnerName: true,
        settings: true,
        paymentCondition: true,
        paymentMethodInt: true,
        cardNumber: true,
      },
    });

    const resolvedSettings = settings ?? {
      currency: "IRR",
      enablePickup: true,
      enableDelivery: true,
      minimumOrderAmount: null,
      deliveryRadius: null,
      deliveryFee: null,
    };

    const {
      capabilities: _capabilities,
      capabilitiesInitializedAt: _capabilitiesInitializedAt,
      ...publicOrganization
    } = organization;

      return NextResponse.json({
        organization: publicOrganization,
        categories: categories,
        settings: resolvedSettings,
        paymentSettings,
      });
  } catch (error) {
    console.error("Error getting shop organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
