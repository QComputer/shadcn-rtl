import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { createMerchantRetailCategory, listMerchantRetailCategories, retailCategoryCreateSchema } from "@/lib/retail/merchant-catalog.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ categories: await listMerchantRetailCategories(context) });
  } catch (error) {
    return jsonError(error, "Could not load store categories.");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context } = await requireRetailMerchantContext();
    const data = retailCategoryCreateSchema.parse(await request.json());
    return NextResponse.json({ category: await createMerchantRetailCategory(context, data) }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not save this category.");
  }
}
