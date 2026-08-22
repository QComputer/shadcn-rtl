import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { readyDemoOrder } from "@/lib/demo-universe/demo-actions.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedRoles: ["STAFF"] });
    const { id } = await params;
    return NextResponse.json({
      order: await readyDemoOrder({
        organizationId: context.organizationId,
        orderId: id,
        session: context.session,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
