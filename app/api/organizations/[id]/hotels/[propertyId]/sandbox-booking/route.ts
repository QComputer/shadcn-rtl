import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelBookingSandboxService, hotelBookingSandboxEnabled } from "@/lib/hotel/sandbox/booking-sandbox.service";

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && Boolean(session.customerContext) };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  if (!hotelBookingSandboxEnabled()) return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelBookingSandboxService().get(await actor(request), id, propertyId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelBookingSandboxService().execute(await actor(request), id, propertyId, await request.json(), request.headers.get("idempotency-key") ?? ""), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
