import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { getMerchantRetailProduct, retailProductUpdateSchema, updateMerchantRetailProduct } from "@/lib/retail/merchant-catalog.server";

type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { context } = await requireRetailMerchantContext();
    const { productId } = await params;
    return NextResponse.json({ product: await getMerchantRetailProduct(context, productId) });
  } catch (error) {
    return jsonError(error, "Could not load the product.");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const { productId } = await params;
    const data = retailProductUpdateSchema.parse(await request.json());
    const product = await updateMerchantRetailProduct(context, session.user.id, productId, data);
    return NextResponse.json({ product });
  } catch (error) {
    return jsonError(error, "Could not update the product.");
  }
}
