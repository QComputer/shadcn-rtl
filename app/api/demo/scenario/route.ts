import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";
import { getDemoScenario } from "@/lib/demo-universe/demo-scenario.service";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request });
    return NextResponse.json({
      scenario: await getDemoScenario({
        organizationId: context.organizationId,
        session: context.session,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
