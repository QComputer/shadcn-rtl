import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { createRetailCheckout, retailCheckoutInput } from "@/lib/retail/checkout.server";

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = retailCheckoutInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Checkout details are invalid.");
    const order = await createRetailCheckout(session.user.id, parsed.data);
    return NextResponse.json({
      orderNumber: order.orderNumber, total: order.total.toString(),
      paymentStatus: order.paymentStatus, orderStatus: order.status,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Retail checkout could not be completed."); }
}
