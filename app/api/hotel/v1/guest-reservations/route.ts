import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { HotelOperationalReservationService } from "@/lib/hotel/services/hotel-operational-reservation.service";
import { resolveHotelTenantForHost } from "@/lib/hotel/services/hotel-publication.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

const inputSchema = z.object({ property: z.string().trim().min(1).max(120), command: z.unknown() }).strict();
const service = new HotelOperationalReservationService();

async function guestScope(request: NextRequest) {
  if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") {
    throw new ApiError(503, "Guest reservations are not operationally enabled");
  }
  const tenant = await resolveHotelTenantForHost(request.headers.get("host"));
  if (!tenant) throw new ApiError(404, "Hotel is not available");
  const session = await requireAuthSession(request);
  if (session.user.role !== "CUSTOMER" || session.customerContext?.organizationId !== tenant.organizationId) {
    throw new ApiError(403, "Customer tenant context required");
  }
  return {
    actor: { userId: session.user.id, role: "CUSTOMER" as const, organizationId: tenant.organizationId, customerContextVerified: true },
    organizationId: tenant.organizationId,
  };
}

async function propertyIdForSlug(organizationId: string, slug: string) {
  const property = await prisma.hotelProperty.findFirst({
    where: { organizationId, slug, isActive: true, deletedAt: null, operationalMode: "RESERVATION" },
    select: { id: true },
  });
  if (!property) throw new ApiError(404, "Property not found");
  return property.id;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await guestScope(request);
    const propertySlug = request.nextUrl.searchParams.get("property")?.trim();
    if (!propertySlug) throw new ApiError(400, "Property is required");
    const propertyId = await propertyIdForSlug(scope.organizationId, propertySlug);
    const result = await service.get(scope.actor, scope.organizationId, propertyId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const scope = await guestScope(request);
    const parsed = inputSchema.safeParse(await readBoundedJson(request, { maxBytes: 64 * 1024 }));
    if (!parsed.success) throw new ApiError(400, "Invalid guest reservation request");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) throw new ApiError(400, "A valid Idempotency-Key is required");
    const propertyId = await propertyIdForSlug(scope.organizationId, parsed.data.property);
    const result = await service.execute(scope.actor, scope.organizationId, propertyId, parsed.data.command, idempotencyKey);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
