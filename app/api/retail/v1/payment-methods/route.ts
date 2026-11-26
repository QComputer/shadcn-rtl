import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { requireCartStore } from "@/lib/retail/cart-access.server";
import { guestCheckoutEnabled } from "@/lib/retail/checkout-owner.server";
import { getRetailPaymentPolicy } from "@/lib/retail/payment-policy.server";
import { getRetailInotiReadiness } from "@/lib/retail/inoti-readiness.server";

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("organization")?.trim();
    if (!slug) throw new ApiError(400, "Store is required.");
    const organization = await requireCartStore(request, slug);
    const policy = await getRetailPaymentPolicy(slug);
    const methods = [];
    if (policy.bankTransferEnabled && policy.bankCardNumber && policy.bankAccountOwner) {
      methods.push({ method: "BANK_TRANSFER", label: "انتقال کارت به کارت",
        bankCardNumber: policy.bankCardNumber, bankAccountOwner: policy.bankAccountOwner });
    }
    if (policy.cashEnabled) methods.push({ method: "CASH", label: "پرداخت نقدی", cashModes: policy.cashModes });
    const inoti = policy.inotiUssdEnabled ? await getRetailInotiReadiness(organization.id) : null;
    if (inoti) methods.push({ method: "INOTI_USSD", label: "پرداخت با کد دستوری", dialString: inoti.dialString });
    return NextResponse.json({ methods, guestCheckoutAvailable: guestCheckoutEnabled() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not load payment methods."); }
}
