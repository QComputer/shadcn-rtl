import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards";
import { aiMediaService } from "@/lib/services/ai-media.service";
import { createAiMediaJobSchema } from "@/lib/validators";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { productId } = await params;

    const product = await requireProductAccess(session, productId, ["ADMIN", "MANAGER"]);
    const localJob = await aiMediaService.getLatestProductJob(product.id, product.organizationId);

    return NextResponse.json({
      job: localJob
        ? {
            job_id: localJob.jobId,
            status: localJob.status,
            provider: localJob.provider,
            created_at: localJob.createdAt.toISOString(),
            updated_at: localJob.updatedAt.toISOString(),
            error_message: localJob.errorMessage,
            outputs: localJob.outputs,
          }
        : null,
      local: localJob,
    });
  } catch (error) {
    return jsonError(error, "Failed to load AI media job");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { productId } = await params;

    const product = await requireProductAccess(session, productId, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const data = createAiMediaJobSchema.parse(body);

    const result = await aiMediaService.createJob(
      product.id,
      product.organizationId,
      session.user.id,
      session.user.role,
      {
        count: data.count,
        aspect_ratio: data.aspect_ratio,
        style_preset: data.style_preset,
        seller_prompt: data.seller_prompt,
      },
    );

    return NextResponse.json(
      {
        job_id: result.job.job_id,
        status: result.job.status,
        provider: result.job.provider,
        local_job_id: result.localJobId,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, "Failed to create AI media job");
  }
}
