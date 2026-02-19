import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentService } from "@/lib/services/appointment.service";
import { createAppointmentSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    
    // Build filter params
    const params: Record<string, string> = {};
    if (searchParams.page) params.page = searchParams.page;
    if (searchParams.pageSize) params.pageSize = searchParams.pageSize;
    if (searchParams.customerId) params.customerId = searchParams.customerId;
    if (searchParams.serviceId) params.serviceId = searchParams.serviceId;
    if (searchParams.status) params.status = searchParams.status;
    if (searchParams.fromDate) params.fromDate = searchParams.fromDate;
    if (searchParams.toDate) params.toDate = searchParams.toDate;

    // Filter by user role
    let appointments;
    if (session.user.role === "CUSTOMER") {
      appointments = await appointmentService.list({
        ...params,
        customerId: session.user.id,
      });
    } else {
      appointments = await appointmentService.list(params);
    }

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Error listing appointments:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createAppointmentSchema.parse(body);

    const appointment = await appointmentService.create(session.user.id, data);

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
