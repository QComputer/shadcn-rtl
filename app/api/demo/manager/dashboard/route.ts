import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getDemoManagerDashboard } from "@/lib/demo-universe/demo-dashboard.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    return NextResponse.json(await getDemoManagerDashboard(context));
  } catch (error) {
    return jsonError(error);
  }
}
