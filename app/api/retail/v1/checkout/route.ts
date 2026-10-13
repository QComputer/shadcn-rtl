import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { createRetailCheckout, retailCheckoutInput } from "@/lib/retail/checkout.server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = retailCheckoutInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Checkout details are invalid.");
    const order = await createRetailCheckout(session.user.id, parsed.data);
    const payment = order.paymentMethod === "BANK_TRANSFER"
      ? await prisma.payment.findUnique({ where: { orderId: order.id }, select: { metadata: true } }) : null;
    const rawMetadata = payment?.metadata;
    const rawRetail = rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata) ? rawMetadata.retailR4 : null;
    const bankSnapshot = rawRetail && typeof rawRetail === "object" && !Array.isArray(rawRetail) ? rawRetail : null;
    return NextResponse.json({
      orderNumber: order.orderNumber, total: order.total.toString(),
      paymentStatus: order.paymentStatus, orderStatus: order.status, paymentMethod: order.paymentMethod,
      ...(order.paymentMethod === "BANK_TRANSFER" ? {
        bankCardNumber: typeof bankSnapshot?.bankCardNumber === "string" ? bankSnapshot.bankCardNumber : null,
        bankAccountOwner: typeof bankSnapshot?.bankAccountOwner === "string" ? bankSnapshot.bankAccountOwner : null,
      } : {}),
      ...(order.paymentMethod === "INOTI_USSD" ? { trackingToken: order.publicTrackingToken } : {}),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Retail checkout could not be completed."); }
}
