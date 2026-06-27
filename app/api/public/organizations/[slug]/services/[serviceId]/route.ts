import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; serviceId: string }> }
) {
  try {
    const { slug, serviceId } = await params;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug, type: "APPOINTMENT", isActive: true },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get service with full details
    const service = await prisma.service.findFirst({
      where: {
        OR: [{ id: serviceId }, { slug: serviceId }],
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        serviceProvider: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
            phone: true,
          },
        },
        _count: {
          select: {
            appointments: {
              where: {
                status: { in: ["COMPLETED", "CONFIRMED"] },
              },
            },
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({
      service: {
        ...service,
        price: Number(service.price),
        bookingCount: service._count.appointments,
      },
    });
  } catch (error) {
    console.error("Error getting service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
