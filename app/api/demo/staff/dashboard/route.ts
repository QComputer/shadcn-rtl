import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getDemoStaffDashboard } from "@/lib/demo-universe/demo-dashboard.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedRoles: ["STAFF"] });
    return NextResponse.json(await getDemoStaffDashboard(context));
  } catch (error) {
    return jsonError(error);
  }
}
