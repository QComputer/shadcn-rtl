import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { createSeoContentRequest, listSeoContentRequests } from "@/lib/seo-content/seo-content.service";
import { readBoundedJson } from "@/lib/security/bounded-json";

const createSchema = z.object({
  businessEntityId: z.string().min(1),
  seoOpportunityId: z.string().min(1).optional(),
  targetKeywords: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  targetLocation: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({
      request,
      allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER", "PLATFORM_ADMIN"],
    });
    return NextResponse.json({ requests: await listSeoContentRequests({ organizationId: context.organizationId }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({
      request,
      allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"],
    });
    const body = createSchema.parse(await readBoundedJson(request));
    return NextResponse.json({
      request: await createSeoContentRequest({
        organizationId: context.organizationId,
        businessEntityId: body.businessEntityId,
        seoOpportunityId: body.seoOpportunityId ?? null,
        targetKeywords: body.targetKeywords,
        targetLocation: body.targetLocation ?? null,
        createdByUserId: null,
        metadata: { demoUniverse: true },
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
