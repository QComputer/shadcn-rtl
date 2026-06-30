import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { applyCreativeStudioAssetSchema } from "@/lib/validators";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioAssetRouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function POST(request: NextRequest, context: CreativeStudioAssetRouteContext) {
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = applyCreativeStudioAssetSchema.parse(body);
    const { session, organizationId } = await requireCreativeStudioOrganization();
    const result = await creativeStudioService.recordAssetApplication(
      assetId,
      organizationId,
      session.user.id,
      input,
    );

    return NextResponse.json({
      ...result,
      publicMutation: false,
    });
  } catch (error) {
    return jsonError(error, "Failed to record Creative Studio asset application");
  }
}
