import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { reviewSeoContentResult } from "@/lib/seo-content/seo-content.service";

const reviewSchema = z.object({
  assetId: z.string().min(1),
  approved: z.boolean(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({
      request,
      allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"],
    });
    const { requestId } = await params;
    const body = reviewSchema.parse(await request.json());
    return NextResponse.json({
      asset: await reviewSeoContentResult({
        organizationId: context.organizationId,
        requestId,
        assetId: body.assetId,
        approved: body.approved,
        reviewerUserId: null,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
