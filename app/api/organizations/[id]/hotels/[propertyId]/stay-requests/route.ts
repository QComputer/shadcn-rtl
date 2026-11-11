import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelStayRequestService } from "@/lib/hotel/services/hotel-stay-request.service";

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && Boolean(session.customerContext) };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().get(await actor(request), id, propertyId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().execute(await actor(request), id, propertyId, await request.json(), request.headers.get("idempotency-key") ?? ""), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().configure(await actor(request), id, propertyId, await request.json()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
