import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { confirmRetailCashCollection } from "@/lib/retail/cash.server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const { orderNumber } = await params;
    return NextResponse.json(await confirmRetailCashCollection({
      organizationId: context.organizationId, orderNumber, actorUserId: session.user.id,
    }));
  } catch (error) { return jsonError(error, "Could not confirm cash collection."); }
}
