import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { runDemoCampaign } from "@/lib/demo-universe/demo-actions.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function POST(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    return NextResponse.json({ event: await runDemoCampaign({ organizationId: context.organizationId }) });
  } catch (error) {
    return jsonError(error);
  }
}
