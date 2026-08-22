import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { createDemoOrder } from "@/lib/demo-universe/demo-actions.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function POST(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedRoles: ["CUSTOMER"] });
    return NextResponse.json(await createDemoOrder(context));
  } catch (error) {
    return jsonError(error);
  }
}
