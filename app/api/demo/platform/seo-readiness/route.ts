import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { getDemoSeoContentReadiness } from "@/lib/seo-content/seo-content.service";

export async function GET(request: NextRequest) {
  try {
    await resolveDemoSessionContext({ request, allowedDemoRoles: ["PLATFORM_ADMIN"] });
    return NextResponse.json(await getDemoSeoContentReadiness());
  } catch (error) {
    return jsonError(error);
  }
}
