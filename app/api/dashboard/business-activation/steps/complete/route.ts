import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { completeOwnerActivationTask } from "@/lib/business-acquisition/owner-activation.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const taskKey = typeof body?.taskKey === "string" ? body.taskKey : typeof body?.actionKey === "string" ? body.actionKey : null;
    if (!taskKey) {
      throw new ApiError(400, "Activation task key is required");
    }

    const dashboard = await completeOwnerActivationTask({
      session,
      organizationId: typeof body.organizationId === "string" ? body.organizationId : null,
      taskKey,
    });

    return NextResponse.json({ dashboard });
  } catch (error) {
    return jsonError(error, "Failed to complete activation step");
  }
}
