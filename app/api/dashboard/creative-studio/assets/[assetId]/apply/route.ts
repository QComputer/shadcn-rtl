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
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId") || input.organizationId;
    const { session, organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const result = await creativeStudioService.recordAssetApplication(
      assetId,
      organizationId,
      session.user.id,
      session.user.role,
      input,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to apply Creative Studio asset");
  }
}
