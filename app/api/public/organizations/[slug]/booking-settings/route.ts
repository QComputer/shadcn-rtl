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
      select: { id: true, timezone: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get or create booking settings
    let settings = await prisma.bookingSettings.findUnique({
      where: { organizationId: organization.id },
    });

    if (!settings) {
      // Return default settings
      settings = {
        id: "default",
        organizationId: organization.id,
        slotDuration: 30,
        bufferBefore: 0,
        bufferAfter: 0,
        minBookingNotice: 60,
        maxBookingAdvance: 43200,
        maxAppointmentsPerDay: null,
        allowCancellation: true,
        cancellationDeadline: 1440,
        requirePhone: true,
        requireEmail: false,
        requireName: true,
        autoConfirm: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json({
      settings: {
        slotDuration: settings.slotDuration,
        bufferBefore: settings.bufferBefore,
        bufferAfter: settings.bufferAfter,
        minBookingNotice: settings.minBookingNotice,
        maxBookingAdvance: settings.maxBookingAdvance,
        maxAppointmentsPerDay: settings.maxAppointmentsPerDay,
        allowCancellation: settings.allowCancellation,
        cancellationDeadline: settings.cancellationDeadline,
        requirePhone: settings.requirePhone,
        requireEmail: settings.requireEmail,
        requireName: settings.requireName,
        autoConfirm: settings.autoConfirm,
      },
      timezone: organization.timezone,
    });
  } catch (error) {
    console.error("Error getting booking settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
