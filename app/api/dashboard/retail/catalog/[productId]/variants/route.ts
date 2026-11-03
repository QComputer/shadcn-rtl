import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { variantGenerationSchema, previewRetailVariantGeneration, generateRetailVariants } from "@/lib/retail/merchant-catalog.server";

type RouteContext = { params: Promise<{ productId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { context, session } = await requireRetailMerchantContext();
    const { productId } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Invalid variant generation request.");
    const { action: requestedAction, ...values } = body;
    if (requestedAction !== undefined && requestedAction !== "preview" && requestedAction !== "generate") throw new ApiError(400, "Invalid variant generation action.");
    const action = requestedAction === "generate" ? "generate" : "preview";
    const parsed = variantGenerationSchema.safeParse(values);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid variant generation settings.");
    const input = parsed.data;
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
