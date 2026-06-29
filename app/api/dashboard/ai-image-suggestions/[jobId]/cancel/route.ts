import { NextResponse } from "next/server";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards";
import { aiMediaService } from "@/lib/services/ai-media.service";

type AiMediaJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

async function requireAiMediaJobAccess(jobId: string) {
  const session = await requireAuthSession();
  const localJob = await aiMediaService.getLocalJob(jobId);

  if (!localJob) {
    throw new ApiError(404, "Job not found");
  }

  await requireOrgAccess(session, localJob.organizationId, ["ADMIN", "MANAGER"]);
  return { organizationId: localJob.organizationId };
}

export async function POST(_request: Request, context: AiMediaJobRouteContext) {
  try {
    const { jobId } = await context.params;
    const { organizationId } = await requireAiMediaJobAccess(jobId);
    const job = await aiMediaService.cancelJob(jobId, organizationId);
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error);
    return jsonError(error, "Failed to cancel AI media job");
  }
}
