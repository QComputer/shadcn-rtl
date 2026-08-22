import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { createSeoContentRequest, listSeoContentRequests } from "@/lib/seo-content/seo-content.service";

const createSchema = z.object({
  businessEntityId: z.string().min(1),
  seoOpportunityId: z.string().min(1).optional(),
  contentType: z.enum([
    "LOCAL_LANDING_PAGE",
    "PRODUCT_CONTENT",
    "SERVICE_CONTENT",
    "FAQ",
    "ARTICLE",
    "SOCIAL_POST",
    "VIDEO_SCRIPT",
    "CAMPAIGN_COPY",
    "BUSINESS_DESCRIPTION",
  ]).optional(),
  locale: z.string().min(2).max(8).optional(),
  targetKeywords: z.array(z.string().min(1)).optional(),
  targetLocation: z.string().min(1).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json({ requests: await listSeoContentRequests({ organizationId: id }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const context = await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = createSchema.parse(await request.json());
    return NextResponse.json({
      request: await createSeoContentRequest({
        organizationId: id,
        businessEntityId: body.businessEntityId,
        seoOpportunityId: body.seoOpportunityId ?? null,
        contentType: body.contentType,
        locale: body.locale,
        targetKeywords: body.targetKeywords,
        targetLocation: body.targetLocation ?? null,
        createdByUserId: context.actorUserId,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
