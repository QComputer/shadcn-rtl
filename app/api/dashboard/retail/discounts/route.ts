import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { createRetailDiscount, listRetailDiscounts, retailDiscountInput } from "@/lib/retail/discounts.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ coupons: await listRetailDiscounts(context.organizationId) });
  } catch (error) { return jsonError(error, "Could not load discounts."); }
}

export async function POST(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const input = retailDiscountInput.parse(await request.json());
    const coupon = await createRetailDiscount(context.organizationId, session.user.id, input);
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) { return jsonError(error, "Could not create discount."); }
}
