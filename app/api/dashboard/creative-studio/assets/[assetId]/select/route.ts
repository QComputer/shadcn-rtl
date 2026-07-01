import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { selectCreativeStudioAssetSchema } from "@/lib/validators";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioAssetSelectRouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function POST(request: NextRequest, context: CreativeStudioAssetSelectRouteContext) {
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = selectCreativeStudioAssetSchema.parse(body);
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId") || input.organizationId;
    const { session, organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const result = await creativeStudioService.selectAsset(
      assetId,
      organizationId,
      session.user.id,
      session.user.role,
      input,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to select Creative Studio asset");
  }
}
