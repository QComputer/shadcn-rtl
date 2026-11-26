import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { createRetailCheckoutQuote } from "@/lib/retail/checkout-quote.server";
import { retailCheckoutQuoteInput } from "@/lib/retail/checkout.contract";
import { requireCheckoutOwner } from "@/lib/retail/checkout-owner.server";

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const parsed = retailCheckoutQuoteInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Checkout details are invalid.");
    const { owner } = await requireCheckoutOwner(request, parsed.data.organization, true);
    const result = await createRetailCheckoutQuote(owner, parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return jsonError(error, "Could not quote checkout."); }
}
