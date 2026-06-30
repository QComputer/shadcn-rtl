import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { requireCreativeStudioOrganization } from "../../../_helpers";

type CreativeStudioCancelRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: CreativeStudioCancelRouteContext) {
  try {
    const { jobId } = await context.params;
    const { session, organizationId } = await requireCreativeStudioOrganization();
    const job = await creativeStudioService.cancelJob(jobId, organizationId, session.user.id);
    return NextResponse.json({ job });
  } catch (error) {
    return jsonError(error, "Failed to cancel Creative Studio job");
  }
}
