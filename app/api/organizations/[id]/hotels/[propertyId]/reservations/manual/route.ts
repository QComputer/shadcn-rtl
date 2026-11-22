import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelOperationalReservationService } from "@/lib/hotel/services/hotel-operational-reservation.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && session.customerContext?.organizationId === session.user.organizationId };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    const result = await new HotelOperationalReservationService().createManual(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 64 * 1024 }), request.headers.get("idempotency-key") ?? "");
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
