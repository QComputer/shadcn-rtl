import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get("categoryId");

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug, type: "APPOINTMENT", isActive: true },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Get services with provider info
    const services = await prisma.service.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        serviceProvider: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Get service categories
    const categories = await prisma.serviceCategory.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            services: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      services: services.map((s) => ({
        ...s,
        price: Number(s.price),
      })),
      categories: categories.map((c) => ({
        ...c,
        serviceCount: c._count.services,
      })),
    });
  } catch (error) {
    console.error("Error getting services:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
