import "server-only";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { ApiError, requireAuthSession, requireCustomerRequestContext } from "@/lib/api-guards";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";

import { appointmentGuestCookieName, appointmentGuestFilter, appointmentGuestSessionPattern } from "@/lib/appointments/guest-scope";

export const privateAppointmentHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const publicAppointmentSlug = /^[a-z0-9][a-z0-9-]{0,127}$/i;

// A reference identifies a booking, not its owner. Never accept a phone,
// booking reference or OTP as the authority to read an appointment.
export async function appointmentOwnerWhere(request: NextRequest, slug: string): Promise<Prisma.AppointmentWhereInput> {
  if (!publicAppointmentSlug.test(slug)) throw new ApiError(400, "Organization is required");
  const tenant = await resolveTenantPwaRequestContext(request.headers);
  if (tenant.kind === "unknown") throw new ApiError(404, "Appointment unavailable");
  const organization = await requireActiveOrganizationCapability({ organizationSlug: slug, capability: "APPOINTMENT", ...(tenant.kind === "tenant" ? { organizationId: tenant.organizationId } : {}) });
  if (organization.slug !== slug || (tenant.kind === "tenant" && organization.id !== tenant.organizationId)) throw new ApiError(404, "Appointment unavailable");
  const scope: Prisma.AppointmentWhereInput = { deletedAt: null, service: { organizationId: organization.id, organization: { isActive: true, deletedAt: null } } };
  let session;
  try { session = await requireAuthSession(); }
  catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
  if (session) {
    // A privileged or wrong-tenant session is not a public customer principal.
    if (session.user.role !== "CUSTOMER") throw new ApiError(403, "Appointment access unavailable");
    const context = await requireCustomerRequestContext(request, session);
    if (context.organizationId !== organization.id) throw new ApiError(403, "Appointment access unavailable");
    return { ...scope, customerId: session.user.id };
  }
  // Existing appointment creation issues an HttpOnly, host-only random UUID cookie.
  // Accept only that format (also used by the existing cart when configured to share it).
  // This is same-browser possession, not verified phone ownership or account creation.
  const sessionId = request.cookies.get(appointmentGuestCookieName())?.value;
  if (!sessionId || !appointmentGuestSessionPattern.test(sessionId)) throw new ApiError(403, "Appointment access unavailable");
  return { ...scope, customerId: null, guestCustomer: appointmentGuestFilter(organization.id, sessionId) };
}

// Deliberately exclude notes, contact data, staff phone, payment fields, and
// internal guest/customer IDs. Historical references remain display-only.
export const publicAppointmentSelect = {
  id: true, bookingReference: true, startTime: true, endTime: true, status: true,
  service: { select: { id: true, name: true, duration: true, price: true,
    organization: { select: { name: true, slug: true, timezone: true, address: true, phone: true } },
    serviceProvider: { select: { firstName: true, lastName: true } },
  } },
} satisfies Prisma.AppointmentSelect;

type AppointmentProjection = Prisma.AppointmentGetPayload<{ select: typeof publicAppointmentSelect }>;
export function appointmentPublicDto(row: AppointmentProjection) {
  return { ...row, service: { ...row.service, price: Number(row.service.price) } };
}
export function appointmentPublicError(error: unknown) {
  const status = error instanceof ApiError && [400, 401, 403, 404, 409, 413].includes(error.status) ? error.status : 500;
  return Response.json({ error: status === 400 ? "Invalid request" : "Appointment access unavailable" }, { status, headers: privateAppointmentHeaders });
}
