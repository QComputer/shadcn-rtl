import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { aiMediaService } from "@/lib/services/ai-media.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { jobId } = await params;

    const localJob = await aiMediaService.getLocalJob(jobId);
    if (!localJob) {
      throw new ApiError(404, "Job not found");
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      localJob.organizationId !== session.user.organizationId
    ) {
      throw new ApiError(403, "Forbidden");
    }

    const status = await aiMediaService.getJobStatus(jobId);

    return NextResponse.json({
      job: status.job,
      local: status.local,
      remoteUnavailable: status.remoteUnavailable,
    });
  } catch (error) {
    return jsonError(error, "Failed to load AI media job");
  }
}
