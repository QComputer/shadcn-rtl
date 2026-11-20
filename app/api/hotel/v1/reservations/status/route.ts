import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";

const schema = z.object({ reference: z.string().min(8).max(40), contactPhone: z.string().min(8).max(24) });

export async function POST(request: Request) {
  try {
    if (process.env.HOTEL_ANONYMOUS_RESERVATION_OPERATIONAL_ENABLED !== "1") throw new ApiError(503, "Anonymous hotel reservations are not operationally enabled");
    const input = schema.parse(parseJsonObject(await request.json()));
    const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
    const phone = normalizeCustomerPhone(input.contactPhone);
    if (!tenant || !phone) throw new ApiError(404, "Reservation is not available");
    const booking = await prisma.hotelReservation.findFirst({ where: { organizationId: tenant.organizationId, reference: input.reference }, include: { guests: true } });
    const guest = booking?.guests.find((item) => item.isPrimary);
    if (!booking || guest?.phoneHash !== hashCustomerIdentifier(tenant.organizationId, phone)) throw new ApiError(404, "Reservation is not available");
    return Response.json({ reference: booking.reference, status: booking.status, paymentStatus: booking.paidAmount >= booking.totalAmount ? "PAID" : "UNPAID", totalAmount: String(booking.totalAmount), currency: booking.currency });
  } catch (error) { return jsonError(error); }
}
