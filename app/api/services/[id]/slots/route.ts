import { NextRequest, NextResponse } from "next/server";
import { appointmentService } from "@/lib/services/appointment.service";
import { jsonError } from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const slots = await appointmentService.getAvailableSlots(id, date);

    return NextResponse.json({ data: slots });
  } catch (error) {
    console.error("Error getting slots:", error);
    return jsonError(error, "Internal server error");
  }
}
