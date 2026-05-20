import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, bookingReference, organizationSlug } = body;

    if (!organizationSlug) {
      return NextResponse.json({ error: "Organization slug is required" }, { status: 400 });
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug, type: "APPOINTMENT", isActive: true },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let appointments;

    if (bookingReference) {
      // Lookup by booking reference
      appointments = await prisma.appointment.findMany({
        where: {
          bookingReference,
          deletedAt: null,
          service: {
            organizationId: organization.id,
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
              organization: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
          customer: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          guestCustomer: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });
    } else if (phone) {
      // Lookup by phone number
      appointments = await prisma.appointment.findMany({
        where: {
          OR: [
            { customerPhoneAtBooking: phone },
            { customer: { phone } },
            { guestCustomer: { phone } },
          ],
          deletedAt: null,
          service: {
            organizationId: organization.id,
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
              organization: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
          customer: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          guestCustomer: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });
    } else {
      return NextResponse.json(
        { error: "Phone number or booking reference is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      appointments: appointments.map((apt) => ({
        ...apt,
        service: {
          ...apt.service,
          price: Number(apt.service.price),
        },
      })),
    });
  } catch (error) {
    console.error("Error looking up appointments:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
