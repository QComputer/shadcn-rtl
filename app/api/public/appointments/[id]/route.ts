import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const phone = searchParams.get("phone");
    const bookingRef = searchParams.get("ref");

    if (!phone && !bookingRef) {
      return NextResponse.json(
        { error: "Phone number or booking reference is required" },
        { status: 400 },
      );
    }

    const where: Record<string, unknown> = {
      id,
      deletedAt: null,
    };

    if (phone) {
      where.OR = [
        { customerPhoneAtBooking: phone },
        { customer: { phone } },
        { guestCustomer: { phone } },
      ];
    } else if (bookingRef) {
      where.bookingReference = bookingRef;
    }

    const appointment = await prisma.appointment.findFirst({
      where,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            duration: true,
            price: true,
            image: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                address: true,
                phone: true,
                email: true,
              },
            },
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
                phone: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        guestCustomer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json({
      appointment: {
        ...appointment,
        service: {
          ...appointment.service,
          price: Number(appointment.service.price),
        },
      },
    });
  } catch (error) {
    console.error("Error getting appointment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
