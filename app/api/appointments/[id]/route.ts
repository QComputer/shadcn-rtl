import { NextRequest, NextResponse } from "next/server";
import { appointmentService } from "@/lib/services/appointment.service";
import { updateAppointmentSchema } from "@/lib/validators";
import {
  jsonError,
  requireAppointmentAccess,
  requireAuthSession,
} from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireAppointmentAccess(session, id, ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]);

    const appointment = await appointmentService.getById(id);
    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error getting appointment:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireAppointmentAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const body = await request.json();
    const data = updateAppointmentSchema.parse(body);
    const appointment = await appointmentService.update(id, data, session.user.role, session.user.id);

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const resource = await requireAppointmentAccess(session, id, ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]);

    if (session.user.role === "CUSTOMER") {
      await appointmentService.cancel(id, session.user.id);
    } else {
      await appointmentService.update(id, { status: "CANCELLED" }, session.user.role, session.user.id);
    }

    return NextResponse.json({ success: true, id: resource.id });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return jsonError(error, "Internal server error");
  }
}
