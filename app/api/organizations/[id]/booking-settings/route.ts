import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bookingSettingsService, BookingSettingsInput } from "@/lib/services/booking-settings.service";
import { hasPermission } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await bookingSettingsService.getForOrganization(id);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error getting booking settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(session.user.role, "settings:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const data: BookingSettingsInput = {};
    
    if (typeof body.slotDuration === "number") data.slotDuration = body.slotDuration;
    if (typeof body.bufferBefore === "number") data.bufferBefore = body.bufferBefore;
    if (typeof body.bufferAfter === "number") data.bufferAfter = body.bufferAfter;
    if (typeof body.minBookingNotice === "number") data.minBookingNotice = body.minBookingNotice;
    if (typeof body.maxBookingAdvance === "number") data.maxBookingAdvance = body.maxBookingAdvance;
    if (typeof body.maxAppointmentsPerDay === "number") data.maxAppointmentsPerDay = body.maxAppointmentsPerDay;
    if (typeof body.allowCancellation === "boolean") data.allowCancellation = body.allowCancellation;
    if (typeof body.cancellationDeadline === "number") data.cancellationDeadline = body.cancellationDeadline;
    if (typeof body.requirePhone === "boolean") data.requirePhone = body.requirePhone;
    if (typeof body.requireEmail === "boolean") data.requireEmail = body.requireEmail;
    if (typeof body.requireName === "boolean") data.requireName = body.requireName;
    if (typeof body.autoConfirm === "boolean") data.autoConfirm = body.autoConfirm;

    const settings = await bookingSettingsService.update(id, data);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating booking settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
