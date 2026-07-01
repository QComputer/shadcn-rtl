import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioAssetRejectRouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function POST(request: NextRequest, context: CreativeStudioAssetRejectRouteContext) {
  try {
    const { assetId } = await context.params;
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const { session, organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const result = await creativeStudioService.rejectAsset(
      assetId,
      organizationId,
      session.user.id,
      session.user.role,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to reject Creative Studio asset");
  }
}
