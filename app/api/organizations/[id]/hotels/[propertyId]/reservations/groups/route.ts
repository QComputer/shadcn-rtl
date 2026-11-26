import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { HotelOperationalReservationService } from "@/lib/hotel/services/hotel-operational-reservation.service";
const headers = { "Cache-Control": "private, no-store" };
async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId };
}
function errorResponse(error: unknown) {
  const response = jsonError(error);
  response.headers.set("Cache-Control", headers["Cache-Control"]);
  return response;
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelOperationalReservationService().listGroups(await actor(request), id, propertyId, new URL(request.url).searchParams.get("reference")), { headers });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelOperationalReservationService().createGroup(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 256 * 1024 }), request.headers.get("idempotency-key") ?? ""), { headers });
  } catch (error) { return errorResponse(error); }
}
