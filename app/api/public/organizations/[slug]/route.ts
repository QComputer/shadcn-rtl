import { NextRequest, NextResponse } from "next/server";
import { organizationService } from "@/lib/services/organization.service";
import { serviceCategoryService } from "@/lib/services/category.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get organization by slug
    const organization = await organizationService.getBySlugPublic(slug);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Only allow APPOINTMENT type for public booking pages
    if (organization.type !== "APPOINTMENT") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get service categories with services
    const categories = await serviceCategoryService.listPublic(organization.id);

    // Get business hours
    const businessHours = await organizationService.getBusinessHours(organization.id);

    return NextResponse.json({
      organization,
      categories,
      businessHours,
    });
  } catch (error) {
    console.error("Error getting organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
