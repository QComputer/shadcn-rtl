import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelStayRequestService } from "@/lib/hotel/services/hotel-stay-request.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && session.customerContext?.organizationId === session.user.organizationId };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().get(await actor(request), id, propertyId), { headers: PRIVATE_NO_STORE });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().execute(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 64 * 1024 }), request.headers.get("idempotency-key")?.trim() ?? ""), { headers: PRIVATE_NO_STORE });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await new HotelStayRequestService().configure(await actor(request), id, propertyId, await readBoundedJson(request, { maxBytes: 64 * 1024 })), { headers: PRIVATE_NO_STORE });
  } catch (error) { return jsonError(error); }
}
