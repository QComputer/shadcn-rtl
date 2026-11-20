import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || token.length < 32) {
      return NextResponse.json(
        { error: "Invalid tracking token" },
        { status: 400 },
      );
    }

    // Hash the provided token to look up in database
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const appointment = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
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
      return NextResponse.json({ error: "Appointment not found or tracking expired" }, { status: 404 });
    }

    const response = NextResponse.json({
      appointment: {
        ...appointment,
        service: {
          ...appointment.service,
          price: Number(appointment.service.price),
        },
      },
    });

    // Security headers to prevent credential leakage
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error) {
    console.error("Error getting appointment by tracking token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}