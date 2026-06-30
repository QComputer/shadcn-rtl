import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../../_helpers";

type CreativeStudioJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: NextRequest, context: CreativeStudioJobRouteContext) {
  try {
    const { jobId } = await context.params;
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const { organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const job = await creativeStudioService.getJob(jobId, organizationId);
    return NextResponse.json({ job });
  } catch (error) {
    return jsonError(error, "Failed to load Creative Studio job");
  }
}
