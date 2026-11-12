import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelOperationalPaymentService } from "@/lib/hotel/services/hotel-operational-payment.service";

async function actor(request: NextRequest) {
  const session = await requireAuthSession(request);
  return { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId,
    customerContextVerified: session.user.role === "CUSTOMER" && Boolean(session.customerContext) };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; reservationId: string }> }) {
  try {
    const { id, propertyId, reservationId } = await params;
    const result = await new HotelOperationalPaymentService().get(await actor(request), id, propertyId, reservationId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; reservationId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id, propertyId, reservationId } = await params;
    const body = await request.json();
    const input = body?.action && body?.reservationId ? body : { ...body, reservationId };
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    const result = await new HotelOperationalPaymentService().execute(await actor(request), id, propertyId, input, idempotencyKey);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
