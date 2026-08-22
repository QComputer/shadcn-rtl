import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getDemoDriverDashboard } from "@/lib/demo-universe/demo-dashboard.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedRoles: ["DRIVER"] });
    return NextResponse.json(await getDemoDriverDashboard(context));
  } catch (error) {
    return jsonError(error);
  }
}
