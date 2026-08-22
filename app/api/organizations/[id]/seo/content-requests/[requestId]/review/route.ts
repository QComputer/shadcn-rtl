import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { reviewSeoContentResult } from "@/lib/seo-content/seo-content.service";

const reviewSchema = z.object({
  assetId: z.string().min(1),
  approved: z.boolean(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, requestId } = await params;
    const context = await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = reviewSchema.parse(await request.json());
    return NextResponse.json({
      asset: await reviewSeoContentResult({
        organizationId: id,
        requestId,
        assetId: body.assetId,
        approved: body.approved,
        reviewerUserId: context.actorUserId,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
