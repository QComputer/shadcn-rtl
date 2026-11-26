import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appointmentService } from "@/lib/services/appointment.service";
import { createAppointmentSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, getActiveMembership, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { appointmentContactPhone, appointmentGuestCookieName, appointmentGuestSessionPattern } from "@/lib/appointments/guest-scope";
import { privateAppointmentHeaders } from "@/lib/appointments/public-ownership.server";
import { appCookiePath } from "@/lib/app-base-path";

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
      const bound = await requireAuthSession(request);
      const organizationId = bound.customerContext?.organizationId;
      if (!organizationId || (params.organizationId && params.organizationId !== organizationId)) throw new ApiError(403, "Forbidden");
      appointments = await appointmentService.list({
        ...params,
        organizationId,
        customerId: bound.user.id,
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

    return NextResponse.json(appointments, { headers: privateAppointmentHeaders });
  } catch (error) {
    console.error("Error listing appointments:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const parsed = createAppointmentSchema.safeParse(await readBoundedJson(request, { maxBytes: 8 * 1024 }));
    if (!parsed.success) throw new ApiError(400, "Invalid appointment request");
    const data = parsed.data;
    const tenant = await resolveTenantPwaRequestContext(request.headers);
    if (tenant.kind === "unknown") throw new ApiError(404, "Appointment unavailable");
    const service = await prisma.service.findFirst({ where: { id: data.serviceId, isActive: true, deletedAt: null,
      ...(tenant.kind === "tenant" ? { organizationId: tenant.organizationId } : {}),
      organization: { isActive: true, deletedAt: null } }, select: { organizationId: true } });
    if (!service) throw new ApiError(404, "Appointment unavailable");
    await requireActiveOrganizationCapability({ organizationId: service.organizationId, capability: "APPOINTMENT" });
    const respond = (appointment: { id: string; bookingReference: string | null; status: string }) => NextResponse.json({
      id: appointment.id, bookingReference: appointment.bookingReference, status: appointment.status,
    }, { status: 201, headers: privateAppointmentHeaders });
    const existingAuth = await auth();
    if (existingAuth?.user?.id) {
      const session = await requireAuthSession(request);
      if (session.user.role === "CUSTOMER") {
        if (session.customerContext?.organizationId !== service.organizationId) throw new ApiError(403, "Appointment unavailable");
      } else if (session.user.role !== "SUPER_ADMIN" && !await getActiveMembership(session.user.id, service.organizationId)) {
        throw new ApiError(403, "Appointment unavailable");
      }
      return respond(await appointmentService.create(session.user.id, data, service.organizationId));
    }
    const name = data.customerName?.trim();
    const phone = data.customerPhone && appointmentContactPhone(data.customerPhone);
    if (!name || name.length < 2 || !phone) throw new ApiError(400, "Valid guest name and phone are required");
    const cookieName = appointmentGuestCookieName();
    const existing = request.cookies.get(cookieName)?.value;
    const sessionId = existing && appointmentGuestSessionPattern.test(existing) ? existing : `appointment-${crypto.randomUUID()}`;
    const appointment = await appointmentService.createForGuest(sessionId, { ...data, customerName: name, customerPhone: phone }, service.organizationId);
    const response = respond(appointment);
    if (sessionId !== existing) response.cookies.set(cookieName, sessionId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: appCookiePath(), maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    const response = jsonError(error, "Appointment could not be created");
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}
