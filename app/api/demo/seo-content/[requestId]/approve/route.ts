import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { approveSeoContentRequest } from "@/lib/seo-content/seo-content.service";

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
    return NextResponse.json({
      request: await approveSeoContentRequest({
        organizationId: context.organizationId,
        requestId,
        approvedByUserId: null,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
