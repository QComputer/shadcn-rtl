import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentService } from "@/lib/services/appointment.service";
import { ApiError, jsonError, requireAuthSession, getActiveMembership } from "@/lib/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;

    const body = await request.json();
    const { startTime, endTime, date } = body as {
      startTime?: string;
      endTime?: string;
      date?: string;
    };

    if (!startTime || !endTime) {
      throw new ApiError(400, "startTime and endTime are required");
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      throw new ApiError(400, "Invalid date format");
    }

    if (newEnd <= newStart) {
      throw new ApiError(400, "endTime must be after startTime");
    }

    const membership = await getActiveMembership(session.user.id);
    if (!membership) {
      throw new ApiError(403, "Forbidden");
    }

    const updated = await appointmentService.reschedule(
      id,
      {
        startTime: newStart,
        endTime: newEnd,
        date: date || new Date(newStart).toISOString().slice(0, 10),
      },
      {
        userId: session.user.id,
        organizationId: membership.organizationId,
        role: session.user.role,
      }
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "Internal server error" },
      { status: error instanceof ApiError ? error.status : 500 }
    );
  }
}
