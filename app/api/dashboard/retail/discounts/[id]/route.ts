import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { retailDiscountInput, retailDiscountStatusInput, updateRetailDiscount, updateRetailDiscountStatus } from "@/lib/retail/discounts.server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const { id } = await params;
    const body: unknown = await request.json();
    const status = retailDiscountStatusInput.safeParse(body);
    const coupon = status.success
      ? await updateRetailDiscountStatus(context.organizationId, session.user.id, id, status.data.isActive)
      : await updateRetailDiscount(context.organizationId, session.user.id, id, retailDiscountInput.parse(body));
    return NextResponse.json({ coupon });
  } catch (error) { return jsonError(error, "Could not update discount."); }
}
