import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { retailCategoryUpdateSchema, updateMerchantRetailCategory } from "@/lib/retail/merchant-catalog.server";

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    assertRetailMutationOrigin(request);
    const { context } = await requireRetailMerchantContext();
    const { categoryId } = await params;
    const data = retailCategoryUpdateSchema.parse(await request.json());
    return NextResponse.json({ category: await updateMerchantRetailCategory(context, categoryId, data) });
  } catch (error) {
    return jsonError(error, "Could not update this category.");
  }
}
