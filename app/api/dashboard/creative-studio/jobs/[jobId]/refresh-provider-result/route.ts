import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioRefreshProviderResultRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: NextRequest, context: CreativeStudioRefreshProviderResultRouteContext) {
  try {
    const { jobId } = await context.params;
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const { session, organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const result = await creativeStudioService.refreshOrganizationBrandProviderResult(
      jobId,
      organizationId,
      session.user.id,
      session.user.role,
    );

    return NextResponse.json({
      ok: true,
      job: result.job,
      assets: result.assets,
      providerStatus: result.providerStatus,
      publicAutoApply: false,
      warnings: result.warnings,
    });
  } catch (error) {
    return jsonError(error, "Failed to refresh Creative Studio provider result");
  }
}
