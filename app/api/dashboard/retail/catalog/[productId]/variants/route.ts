import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { variantGenerationSchema, previewRetailVariantGeneration, generateRetailVariants } from "@/lib/retail/merchant-catalog.server";

type RouteContext = { params: Promise<{ productId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { context, session } = await requireRetailMerchantContext();
    const { productId } = await params;
    const body = await request.json();
    const action = body.action === "generate" ? "generate" : "preview";
    const input = variantGenerationSchema.parse(body);
    if (action === "preview") {
      const preview = await previewRetailVariantGeneration(context, productId, input);
      return NextResponse.json({ preview });
    }
    if (action === "generate") {
      assertRetailMutationOrigin(request);
      const result = await generateRetailVariants(context, session.user.id, productId, input);
      return NextResponse.json({ result });
    }
    throw new Error("Invalid action");
  } catch (error) {
    return jsonError(error, "Could not process variant generation.");
  }
}
