import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelOperationalReservationService } from "@/lib/hotel/services/hotel-operational-reservation.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && session.customerContext?.organizationId === session.user.organizationId };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelOperationalReservationService().get(await actor(request), id, propertyId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelOperationalReservationService().execute(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 64 * 1024 }), request.headers.get("idempotency-key") ?? ""), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelOperationalReservationService().configure(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 64 * 1024 })), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
