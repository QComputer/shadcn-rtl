import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { reviewInput, reviewRetailPaymentReport } from "@/lib/retail/payment-reports.server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const parsed = reviewInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Review decision is invalid.");
    const { id } = await params;
    return NextResponse.json(await reviewRetailPaymentReport({
      organizationId: context.organizationId, actorUserId: session.user.id, reportId: id,
      action: parsed.data.action, reason: parsed.data.reason,
    }));
  } catch (error) { return jsonError(error, "Could not review payment report."); }
}
