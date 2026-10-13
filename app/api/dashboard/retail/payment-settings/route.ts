import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { getRetailPaymentPolicy, retailPaymentPolicyInput, saveRetailPaymentPolicy } from "@/lib/retail/payment-policy.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ settings: await getRetailPaymentPolicy(context.organizationSlug) });
  } catch (error) { return jsonError(error, "Could not load payment settings."); }
}

export async function PUT(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const parsed = retailPaymentPolicyInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Payment settings are invalid.");
    return NextResponse.json({ settings: await saveRetailPaymentPolicy(context.organizationSlug, context.organizationId, session.user.id, parsed.data) });
  } catch (error) { return jsonError(error, "Could not save payment settings."); }
}
