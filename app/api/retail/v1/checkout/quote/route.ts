import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { createRetailCheckoutQuote } from "@/lib/retail/checkout-quote.server";
import { retailCheckoutQuoteInput } from "@/lib/retail/checkout.contract";

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = retailCheckoutQuoteInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Checkout details are invalid.");
    const result = await createRetailCheckoutQuote(session.user.id, parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not quote checkout."); }
}
