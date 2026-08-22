import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { analyzeOrganizationEntity } from "@/lib/seo-intelligence/seo-intelligence.service";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({
      request,
      allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER", "PLATFORM_ADMIN"],
    });
    return NextResponse.json(await analyzeOrganizationEntity(context.organizationId));
  } catch (error) {
    return jsonError(error);
  }
}
