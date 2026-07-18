import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireCurrentOrganizationId } from "@/lib/api-guards";
import { getAiMediaAssetForUse } from "@/lib/services/ai-media-asset-service";
import { assertAiMediaAssetConsumptionEnabled } from "@/lib/ai-media/asset-consumption-feature-guard";

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

    const asset = await getAiMediaAssetForUse(id, organizationId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    return jsonError(error, "Failed to load AI media asset");
  }
}
