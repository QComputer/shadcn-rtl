import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { streamAiMediaAssetContent } from "@/lib/services/ai-media-asset-service";
import { assertAiMediaAssetConsumptionEnabled } from "@/lib/ai-media/asset-consumption-feature-guard";
import { APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES } from "@/lib/storage/image-validation";

const ALLOWED_CONTENT_TYPES = new Set([...APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.keys()]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuthSession();
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId || undefined);
    const { id } = await context.params;

    // Fail-closed before any asset query: Production is disabled until storageKey migration + storage activation.
    assertAiMediaAssetConsumptionEnabled();

    const client = prisma as any;
    const asset = await client.aiMediaAsset.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { import: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const mimeType = asset.mimeType ?? "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    }

    const stream = await streamAiMediaAssetContent(asset, organizationId);
    if (!stream) {
      return NextResponse.json({ error: "Asset content is not available" }, { status: 404 });
    }

    const extension = asset.storageProvider === "local-test"
      ? asset.storageKeyFingerprint?.split(".").pop() ?? "bin"
      : APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.get(mimeType) ?? "bin";

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", `inline; filename="${asset.id}.${extension}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, no-store");

    return new NextResponse(stream as any, { headers });
  } catch (error) {
    return jsonError(error, "Failed to stream AI media asset content");
  }
}
