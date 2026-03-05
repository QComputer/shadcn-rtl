import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug, type: "APPOINTMENT", isActive: true },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get staff members who can provide services
    const staff = await prisma.organizationMember.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            role:true,
            firstName: true,
            lastName: true,
            avatar: true,
            phone: true,
            email: true,
          },
        },
        _count: {
          select: {
            availability: true,
          },
        },
      },
    });

    // Get services provided by each staff member
    const staffWithServices = await Promise.all(
      staff.map(async (member) => {
        const services = await prisma.service.findMany({
          where: {
            serviceProviderId: member.userId,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        });

        return {
          id: member.id,
          userId: member.userId,
          role: member.user.role,
          user: member.user,
          services: services.map((s) => ({
            ...s,
            price: Number(s.price),
          })),
          hasAvailability: member._count.availability > 0,
        };
      })
    );

    // Only return staff who have services assigned
    const activeStaff = staffWithServices.filter((s) => s.services.length > 0);

    return NextResponse.json({ staff: activeStaff });
  } catch (error) {
    console.error("Error getting staff:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
