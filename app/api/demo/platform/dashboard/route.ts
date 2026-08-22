import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getDemoPlatformDashboard } from "@/lib/demo-universe/demo-dashboard.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function GET(request: NextRequest) {
  try {
    await resolveDemoSessionContext({ request, allowedDemoRoles: ["PLATFORM_ADMIN"] });
    return NextResponse.json(await getDemoPlatformDashboard());
  } catch (error) {
    return jsonError(error);
  }
}
