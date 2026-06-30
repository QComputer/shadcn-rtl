import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioCancelRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: NextRequest, context: CreativeStudioCancelRouteContext) {
  try {
    const { jobId } = await context.params;
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId");
    const { session, organizationId } = await requireCreativeStudioOrganization(requestedOrganizationId);
    const job = await creativeStudioService.cancelJob(jobId, organizationId, session.user.id);
    return NextResponse.json({ job });
  } catch (error) {
    return jsonError(error, "Failed to cancel Creative Studio job");
  }
}
