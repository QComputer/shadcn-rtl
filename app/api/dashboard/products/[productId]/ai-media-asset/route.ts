import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards";
import {
  attachAiMediaAssetToProduct,
  detachAiMediaAssetFromProduct,
} from "@/lib/services/ai-media-entity-attachment-service";

const attachSchema = z.object({
  aiMediaAssetId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { productId } = await params;
    await requireProductAccess(session, productId, ["ADMIN", "MANAGER"]);
    const body = attachSchema.parse(await request.json());

    const result = await attachAiMediaAssetToProduct({
      productId,
      aiMediaAssetId: body.aiMediaAssetId,
      actorRole: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to attach AI media asset to product");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { productId } = await params;
    await requireProductAccess(session, productId, ["ADMIN", "MANAGER"]);

    const result = await detachAiMediaAssetFromProduct({
      productId,
      actorRole: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to detach AI media asset from product");
  }
}
