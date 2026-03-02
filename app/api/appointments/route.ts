import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentService } from "@/lib/services/appointment.service";
import { createAppointmentSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    
    // Build filter params
    const params: Record<string, string | undefined> = {};
    if (searchParams.page) params.page = searchParams.page;
    if (searchParams.pageSize) params.pageSize = searchParams.pageSize;
    if (searchParams.customerId) params.customerId = searchParams.customerId;
    if (searchParams.guestCustomerId) params.guestCustomerId = searchParams.guestCustomerId;
    if (searchParams.serviceId) params.serviceId = searchParams.serviceId;
    if (searchParams.status) params.status = searchParams.status;
    if (searchParams.fromDate) params.fromDate = searchParams.fromDate;
    if (searchParams.toDate) params.toDate = searchParams.toDate;
    if (searchParams.organizationId) params.organizationId = searchParams.organizationId;

    // Filter by user role
    let appointments;
    if (session.user.role === "CUSTOMER") {
      appointments = await appointmentService.list({
        ...params,
        customerId: session.user.id,
      });
    } else if (session.user.role === "STAFF") {
      // Staff members see appointments where they are the service provider
      // First get their membership to find the organization
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      
      appointments = await appointmentService.list({
        ...params,
        organizationId: membership?.organizationId,
        serviceProviderId: session.user.id,
      });
    } else {
      // For admin/manager, auto-filter by their organization if not specified
      if (!params.organizationId && session.user.isTeamMember) {
        const membership = await prisma.organizationMember.findFirst({
          where: { userId: session.user.id },
          select: { organizationId: true },
        });
        if (membership) {
          params.organizationId = membership.organizationId;
        }
      }
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
    const body = await request.json();
    const data = createAppointmentSchema.parse(body);

    let customerId: string;

    // If user is authenticated, use their ID
    if (session?.user?.id) {
      customerId = session.user.id;
    } 
    // If guest booking, find or create customer
    else if (data.customerName && data.customerPhone) {
      // Check if customer exists with this phone
      let customer = await prisma.user.findFirst({
        where: { phone: data.customerPhone },
      });

      if (!customer) {
        // Create new guest customer
        const nameParts = data.customerName.split(" ");
        const firstName = nameParts[0] || data.customerName;
        const lastName = nameParts.slice(1).join(" ") || "";
        
        customer = await prisma.user.create({
          data: {
            name: data.customerPhone, // Use phone as username
            password: "123456",//crypto.randomUUID(), // Random password for guest
            firstName,
            lastName,
            phone: data.customerPhone,
            email: data.customerEmail || null,
            role: "CUSTOMER",
          },
        });
      }

      customerId = customer.id;
    } else {
      return NextResponse.json({ 
        error: "Authentication required or customer details (name and phone) must be provided" 
      }, { status: 400 });
    }

    const appointment = await appointmentService.create(customerId, data);

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
