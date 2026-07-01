import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import {
  createCreativeStudioJobSchema,
  creativeStudioJobFilterSchema,
} from "@/lib/validators";
import { requireCreativeStudioOrganization } from "../_helpers";

export async function GET(request: NextRequest) {
  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filter = creativeStudioJobFilterSchema.parse(query);
    const { organizationId } = await requireCreativeStudioOrganization(filter.organizationId);
    const result = await creativeStudioService.listJobs(organizationId, filter);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to load Creative Studio jobs");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createCreativeStudioJobSchema.parse(body);
    const { session, organizationId } = await requireCreativeStudioOrganization(input.organizationId);
    const result = await creativeStudioService.createJob(
      organizationId,
      session.user.id,
      session.user.role,
      input,
    );

    return NextResponse.json({
      job: result.job,
      asset: result.asset,
      provider: result.job.provider,
      execution: "execution" in result ? result.execution : undefined,
      publicMutation: false,
    }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to create Creative Studio job");
  }
}
