import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentService } from "@/lib/services/appointment.service";
import { createAppointmentSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, getActiveMembership } from "@/lib/api-guards";
import { appCookiePath } from "@/lib/app-base-path";

function splitName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  return {
    firstName: nameParts[0] || fullName,
    lastName: nameParts.slice(1).join(" ") || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new ApiError(401, "Unauthorized");
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    const params: {
      page?: number;
      pageSize?: number;
      customerId?: string;
      guestCustomerId?: string;
      serviceId?: string;
      serviceProviderId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
      organizationId?: string;
    } = {};
    if (searchParams.page) params.page = Math.max(Number.parseInt(searchParams.page, 10) || 1, 1);
    if (searchParams.pageSize) params.pageSize = Math.min(Math.max(Number.parseInt(searchParams.pageSize, 10) || 20, 1), 500);
    if (searchParams.customerId) params.customerId = searchParams.customerId;
    if (searchParams.guestCustomerId) params.guestCustomerId = searchParams.guestCustomerId;
    if (searchParams.serviceId) params.serviceId = searchParams.serviceId;
    if (searchParams.serviceProviderId) params.serviceProviderId = searchParams.serviceProviderId;
    if (searchParams.status) params.status = searchParams.status;
    if (searchParams.fromDate) params.fromDate = searchParams.fromDate;
    if (searchParams.toDate) params.toDate = searchParams.toDate;
    if (searchParams.organizationId) params.organizationId = searchParams.organizationId;

    let appointments;
    if (session.user.role === "CUSTOMER") {
      appointments = await appointmentService.list({
        ...params,
        customerId: session.user.id,
        guestCustomerId: undefined,
      });
    } else if (session.user.role === "STAFF") {
      const membership = await getActiveMembership(session.user.id);
      if (!membership) {
        throw new ApiError(403, "Forbidden");
      }

      appointments = await appointmentService.list({
        ...params,
        organizationId: membership.organizationId,
        serviceProviderId: session.user.id,
      });
    } else if (session.user.role === "SUPER_ADMIN") {
      appointments = await appointmentService.list(params);
    } else {
      const membership = await getActiveMembership(session.user.id);
      if (!membership) {
        throw new ApiError(403, "Forbidden");
      }
      if (params.organizationId && params.organizationId !== membership.organizationId) {
        throw new ApiError(403, "Forbidden");
      }
      appointments = await appointmentService.list({
        ...params,
        organizationId: membership.organizationId,
      });
    }

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Error listing appointments:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const data = createAppointmentSchema.parse(body);

    if (session?.user?.id) {
      const appointment = await appointmentService.create(session.user.id, data);
      return NextResponse.json(appointment, { status: 201 });
    }

    if (!data.customerName || !data.customerPhone) {
      throw new ApiError(
        400,
        "Authentication required or guest customer details (name and phone) must be provided",
      );
    }

    const { firstName, lastName } = splitName(data.customerName);
    const sessionId =
      request.cookies.get(process.env.SESSION_COOKIE_NAME || "guest_session_id_local")?.value ||
      `appointment-${crypto.randomUUID()}`;

    const guestCustomer = await prisma.guestCustomer.upsert({
      where: { sessionId },
      update: {
        name: data.customerName,
        firstName,
        lastName,
        phone: data.customerPhone,
        email: data.customerEmail || null,
      },
      create: {
        sessionId,
        name: data.customerName,
        firstName,
        lastName,
        phone: data.customerPhone,
        email: data.customerEmail || null,
      },
    });

    const appointment = await appointmentService.createForGuest(guestCustomer.id, {
      ...data,
      customerName: data.customerName,
    });

    const response = NextResponse.json(appointment, { status: 201 });
    if (!request.cookies.get(process.env.SESSION_COOKIE_NAME || "guest_session_id_local")?.value) {
      response.cookies.set(process.env.SESSION_COOKIE_NAME || "guest_session_id_local", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: appCookiePath(),
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    console.error("Error creating appointment:", error);
    return jsonError(error, "Internal server error");
  }
}
