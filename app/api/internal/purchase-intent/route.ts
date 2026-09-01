import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolvePurchaseIntent, sanitizeAttribution } from "@/lib/purchase-intent-adapter";

const purchaseIntentQuerySchema = z.object({
  organizationId: z.string().min(1),
  productId: z.string().min(1).optional(),
  productSlug: z.string().min(1).optional(),
  source: z.string().max(80).optional(),
  campaign: z.string().max(80).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const parsed = purchaseIntentQuerySchema.safeParse({
    organizationId: searchParams.get("organizationId"),
    productId: searchParams.get("productId"),
    productSlug: searchParams.get("productSlug"),
    source: searchParams.get("source"),
    campaign: searchParams.get("campaign"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid purchase intent query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { organizationId, productId, productSlug } = parsed.data;

  if (!productId && !productSlug) {
    return NextResponse.json(
      { error: "Either productId or productSlug is required" },
      { status: 400 },
    );
  }

  const attribution = sanitizeAttribution({
    source: parsed.data.source,
    campaign: parsed.data.campaign,
  });

  let resolution;
  if (productId) {
    resolution = await resolvePurchaseIntent({
      organizationId,
      productId,
      attribution,
    });
  } else {
    const { resolvePurchaseIntentBySlug } = await import("@/lib/purchase-intent-adapter");
    resolution = await resolvePurchaseIntentBySlug({
      organizationId,
      productSlug: productSlug!,
      attribution,
    });
  }

  if (!resolution) {
    return NextResponse.json(
      { error: "Purchase intent not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    organizationId: resolution.organizationId,
    organizationSlug: resolution.organizationSlug,
    productId: resolution.productId,
    product: resolution.product,
    attribution,
  });
}
